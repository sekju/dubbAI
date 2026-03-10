from unittest.mock import Mock

import pytest

from app.db.session import SessionLocal
from app.models.job import PipelineJob
from app.models.project import Project
from app.models.transcript import TranscriptSegment
from app.tasks.ai import StageConflictError, transcribe_project, translate_project


def _create_project(client) -> str:
    response = client.post(
        "/api/projects/import",
        json={"name": "Pipeline project", "source_url": "https://example.com/video"},
    )

    assert response.status_code == 202
    return response.json()["project_id"]


def test_transcribe_endpoint_sets_transcript_stage_to_queued(client, monkeypatch) -> None:
    project_id = _create_project(client)

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.transcribe_project_task.delay", delay_mock)

    response = client.post(f"/api/projects/{project_id}/transcribe")

    assert response.status_code == 202
    payload = response.json()
    assert payload["queue"] == "app.tasks.ai.transcribe_project"
    delay_mock.assert_called_once_with(payload["job_id"], project_id)

    detail = client.get(f"/api/projects/{project_id}")

    assert detail.status_code == 200
    assert detail.json()["status"] == "transcription_queued"
    assert detail.json()["transcript_status"] == "queued"


def test_translate_endpoint_sets_translation_stage_to_queued_without_changing_legacy_status(
    client,
    monkeypatch,
) -> None:
    with SessionLocal() as db:
        db.add(
            Project(
                id="project-ready-for-translate",
                owner_id="local-dev",
                name="Ready for translate",
                source_type="upload",
                source_url="/storage/uploads/project-ready-for-translate/clip.mp4",
                status="transcribed",
                transcript_status="ready",
                translation_status="not_started",
            )
        )
        db.commit()

    project_id = "project-ready-for-translate"

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.translate_project_task.delay", delay_mock)

    response = client.post(f"/api/projects/{project_id}/translate")

    assert response.status_code == 202
    payload = response.json()
    assert payload["queue"] == "app.tasks.ai.translate_project"
    delay_mock.assert_called_once_with(payload["job_id"], project_id)

    detail = client.get(f"/api/projects/{project_id}")

    assert detail.status_code == 200
    assert detail.json()["status"] == "transcribed"
    assert detail.json()["translation_status"] == "queued"


def test_project_detail_serializes_completed_transcript_and_translation_states(client) -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-ready",
            owner_id="local-dev",
            name="Ready project",
            source_type="upload",
            source_url="/storage/uploads/project-ready/clip.mp4",
            source_language="en",
            target_language="pl",
            status="translated",
            transcript_status="ready",
            translation_status="ready",
        )
        segment = TranscriptSegment(
            id="segment-ready",
            project_id=project.id,
            speaker="Speaker A",
            start_ms=0,
            end_ms=1000,
            original_text="Hello",
            translated_text="Czesc",
        )
        db.add_all([project, segment])
        db.commit()

    response = client.get("/api/projects/project-ready")

    assert response.status_code == 200
    assert response.json() == {
        "id": "project-ready",
        "name": "Ready project",
        "source_type": "upload",
        "source_url": "/storage/uploads/project-ready/clip.mp4",
        "source_language": "en",
        "target_language": "pl",
        "status": "transcribed",
        "transcript_status": "ready",
        "translation_status": "ready",
        "dubbing_status": "not_started",
        "transcript_segments": [
            {
                "speaker": "Speaker A",
                "start_ms": 0,
                "end_ms": 1000,
                "original_text": "Hello",
                "translated_text": "Czesc",
                "words": [],
            }
        ],
    }


def test_transcription_only_completion_hides_translation_output_in_project_detail(
    client,
    tmp_path,
    monkeypatch,
) -> None:
    source_path = tmp_path / "source.mp4"
    source_path.write_bytes(b"video")

    with SessionLocal() as db:
        project = Project(
            id="project-transcribed",
            owner_id="local-dev",
            name="Transcribed project",
            source_type="upload",
            source_url=str(source_path),
            status="transcription_queued",
            transcript_status="queued",
            translation_status="not_started",
        )
        job = PipelineJob(
            id="job-transcribed",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.transcribe_project",
        )
        db.add_all([project, job])
        db.commit()

    def fake_extract_audio(source, audio_path) -> None:
        assert source == source_path
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        audio_path.write_bytes(b"audio")

    class FakeGeminiClient:
        async def transcribe_translate(self, audio_bytes: bytes) -> dict[str, object]:
            assert audio_bytes == b"audio"
            return {
                "segments": [
                    {
                        "speaker": "Speaker A",
                        "start_ms": 0,
                        "end_ms": 1000,
                        "original_text": "Hello",
                        "translated_text": "Czesc",
                        "words": [],
                    }
                ]
            }

    monkeypatch.setattr("app.tasks.ai.extract_audio", fake_extract_audio)
    monkeypatch.setattr("app.tasks.ai.GeminiClient", FakeGeminiClient)

    result = transcribe_project("job-transcribed", "project-transcribed")

    assert result == {"project_id": "project-transcribed", "status": "transcribed"}

    response = client.get("/api/projects/project-transcribed")

    assert response.status_code == 200
    assert response.json()["transcript_status"] == "ready"
    assert response.json()["translation_status"] == "not_started"
    assert response.json()["transcript_segments"] == [
        {
            "speaker": "Speaker A",
            "start_ms": 0,
            "end_ms": 1000,
            "original_text": "Hello",
            "translated_text": "",
            "words": [],
        }
    ]


@pytest.mark.parametrize("translation_status", ["queued", "in_progress", "ready", "failed"])
def test_transcribe_endpoint_rejects_when_translation_has_started(
    client,
    monkeypatch,
    translation_status: str,
) -> None:
    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.transcribe_project_task.delay", delay_mock)

    with SessionLocal() as db:
        project = Project(
            id=f"project-transcribe-conflict-{translation_status}",
            owner_id="local-dev",
            name="Transcribe conflict",
            source_type="upload",
            source_url="/storage/uploads/project-transcribe-conflict/clip.mp4",
            status="transcribed",
            transcript_status="ready",
            translation_status=translation_status,
        )
        db.add(project)
        db.commit()

    response = client.post(f"/api/projects/project-transcribe-conflict-{translation_status}/transcribe")

    assert response.status_code == 409
    assert "translation" in response.json()["detail"]
    delay_mock.assert_not_called()


@pytest.mark.parametrize("transcript_status", ["queued", "in_progress"])
def test_translate_endpoint_rejects_when_transcription_is_active(
    client,
    monkeypatch,
    transcript_status: str,
) -> None:
    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.translate_project_task.delay", delay_mock)

    with SessionLocal() as db:
        project = Project(
            id=f"project-translate-conflict-{transcript_status}",
            owner_id="local-dev",
            name="Translate conflict",
            source_type="upload",
            source_url="/storage/uploads/project-translate-conflict/clip.mp4",
            status="transcription_queued" if transcript_status == "queued" else "transcribing",
            transcript_status=transcript_status,
            translation_status="not_started",
        )
        db.add(project)
        db.commit()

    response = client.post(f"/api/projects/project-translate-conflict-{transcript_status}/translate")

    assert response.status_code == 409
    assert "transcription" in response.json()["detail"]
    delay_mock.assert_not_called()


def test_translate_endpoint_requires_ready_transcript(client, monkeypatch) -> None:
    project_id = _create_project(client)

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.translate_project_task.delay", delay_mock)

    response = client.post(f"/api/projects/{project_id}/translate")

    assert response.status_code == 409
    assert "before transcription is ready" in response.json()["detail"]
    delay_mock.assert_not_called()


@pytest.mark.parametrize("translation_status", ["queued", "in_progress", "ready", "failed"])
def test_translate_endpoint_rejects_when_translation_has_already_started(
    client,
    monkeypatch,
    translation_status: str,
) -> None:
    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.translate_project_task.delay", delay_mock)

    with SessionLocal() as db:
        project = Project(
            id=f"project-translate-existing-{translation_status}",
            owner_id="local-dev",
            name="Translate existing",
            source_type="upload",
            source_url="/storage/uploads/project-translate-existing/clip.mp4",
            status="transcribed",
            transcript_status="ready",
            translation_status=translation_status,
        )
        db.add(project)
        db.commit()

    response = client.post(f"/api/projects/project-translate-existing-{translation_status}/translate")

    assert response.status_code == 409
    assert "Translation has already been started" in response.json()["detail"]
    delay_mock.assert_not_called()


def test_translate_task_rejects_when_transcript_is_not_ready(tmp_path) -> None:
    source_path = tmp_path / "source.mp4"
    source_path.write_bytes(b"video")

    with SessionLocal() as db:
        project = Project(
            id="project-translate-only",
            owner_id="local-dev",
            name="Translate only",
            source_type="upload",
            source_url=str(source_path),
            target_language="pl",
            status="queued",
            transcript_status="not_started",
            translation_status="queued",
        )
        job = PipelineJob(
            id="job-translate-only",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.translate_project",
        )
        db.add_all([project, job])
        db.commit()

    with pytest.raises(StageConflictError, match="before transcription is ready"):
        translate_project("job-translate-only", "project-translate-only")

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-translate-only")
        saved_segments = db.query(TranscriptSegment).filter_by(project_id="project-translate-only").all()

        assert saved_project is not None
        assert saved_project.status == "queued"
        assert saved_project.transcript_status == "not_started"
        assert saved_project.translation_status == "queued"
        assert saved_segments == []


def test_translate_task_updates_existing_segments_without_replacing_transcript(monkeypatch) -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-translate-ready",
            owner_id="local-dev",
            name="Translate ready",
            source_type="upload",
            source_url="/storage/uploads/project-translate-ready/clip.mp4",
            target_language="pl",
            status="transcribed",
            transcript_status="ready",
            translation_status="queued",
        )
        segment = TranscriptSegment(
            id="segment-translate-ready",
            project_id=project.id,
            speaker="Speaker A",
            start_ms=125,
            end_ms=950,
            original_text="Hello",
            translated_text="",
        )
        job = PipelineJob(
            id="job-translate-ready",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.translate_project",
        )
        db.add_all([project, segment, job])
        db.commit()

    class FakeGeminiClient:
        async def translate_segments(
            self,
            segments: list[dict[str, object]],
            target_language: str = "pl",
        ) -> list[str]:
            assert target_language == "pl"
            assert segments == [
                {
                    "speaker": "Speaker A",
                    "start_ms": 125,
                    "end_ms": 950,
                    "original_text": "Hello",
                }
            ]
            return ["Czesc"]

    monkeypatch.setattr("app.tasks.ai.GeminiClient", FakeGeminiClient)

    result = translate_project("job-translate-ready", "project-translate-ready")

    assert result == {"project_id": "project-translate-ready", "status": "transcribed"}

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-translate-ready")
        saved_segment = db.get(TranscriptSegment, "segment-translate-ready")

        assert saved_project is not None
        assert saved_project.status == "transcribed"
        assert saved_project.transcript_status == "ready"
        assert saved_project.translation_status == "ready"
        assert saved_segment is not None
        assert saved_segment.speaker == "Speaker A"
        assert saved_segment.start_ms == 125
        assert saved_segment.end_ms == 950
        assert saved_segment.original_text == "Hello"
        assert saved_segment.translated_text == "Czesc"
