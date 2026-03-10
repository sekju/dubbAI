from unittest.mock import Mock

from app.db.session import SessionLocal
from app.models.job import PipelineJob
from app.models.project import Project
from app.models.transcript import TranscriptSegment
from app.tasks.ai import transcribe_project, translate_project


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


def test_translate_endpoint_sets_translation_stage_to_queued(client, monkeypatch) -> None:
    project_id = _create_project(client)

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.translate_project_task.delay", delay_mock)

    response = client.post(f"/api/projects/{project_id}/translate")

    assert response.status_code == 202
    payload = response.json()
    assert payload["queue"] == "app.tasks.ai.translate_project"
    delay_mock.assert_called_once_with(payload["job_id"], project_id)

    detail = client.get(f"/api/projects/{project_id}")

    assert detail.status_code == 200
    assert detail.json()["status"] == "translation_queued"
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
        "status": "translated",
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


def test_translate_task_does_not_mark_transcript_ready_when_it_was_not_started(
    tmp_path,
    monkeypatch,
) -> None:
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
            status="translation_queued",
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

    def fake_extract_audio(source, audio_path) -> None:
        assert source == source_path
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        audio_path.write_bytes(b"audio")

    class FakeGeminiClient:
        async def translate(self, audio_bytes: bytes, target_language: str = "pl") -> dict[str, object]:
            assert audio_bytes == b"audio"
            assert target_language == "pl"
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

    result = translate_project("job-translate-only", "project-translate-only")

    assert result == {"project_id": "project-translate-only", "status": "translated"}

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-translate-only")
        saved_segments = db.query(TranscriptSegment).filter_by(project_id="project-translate-only").all()

        assert saved_project is not None
        assert saved_project.transcript_status == "not_started"
        assert saved_project.translation_status == "ready"
        assert len(saved_segments) == 1
        assert saved_segments[0].translated_text == "Czesc"
