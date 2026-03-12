from pathlib import Path
from unittest.mock import Mock

import pytest

from app.db.session import SessionLocal
from app.models.job import PipelineJob
from app.models.project import Project
from app.models.transcript import TranscriptSegment, TranscriptWord
from app.tasks.ai import StageConflictError, transcribe_project, translate_project


def _tmp_media_path(filename: str) -> str:
    path = (
        Path(__file__).resolve().parents[2]
        / "storage"
        / "test-suite"
        / "tmp-media"
        / filename
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


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


def test_transcribe_endpoint_allows_retry_after_failed_transcription_and_clears_transcript_data(
    client,
    monkeypatch,
) -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-retry-transcribe",
            owner_id="local-dev",
            name="Retry transcription",
            source_type="upload",
            source_url="/storage/uploads/project-retry-transcribe/clip.mp4",
            status="transcription_failed",
            transcript_status="failed",
            translation_status="not_started",
        )
        segment = TranscriptSegment(
            id="segment-retry-transcribe",
            project_id=project.id,
            speaker="Speaker A",
            start_ms=0,
            end_ms=400,
            original_text="Broken",
            translated_text="",
        )
        word = TranscriptWord(
            id="word-retry-transcribe",
            project_id=project.id,
            position=1,
            start_ms=0,
            end_ms=400,
            original_text="Broken",
            translated_text="",
            keyword=False,
        )
        db.add_all([project, segment, word])
        db.commit()

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.transcribe_project_task.delay", delay_mock)

    response = client.post("/api/projects/project-retry-transcribe/transcribe")

    assert response.status_code == 202
    payload = response.json()
    delay_mock.assert_called_once_with(payload["job_id"], "project-retry-transcribe")

    detail = client.get("/api/projects/project-retry-transcribe")
    assert detail.status_code == 200
    assert detail.json()["transcript_status"] == "queued"
    assert detail.json()["translation_status"] == "not_started"
    assert detail.json()["transcript_segments"] == []
    assert detail.json()["transcript_words"] == []


def test_translate_endpoint_allows_retry_after_failed_translation_and_clears_translation_output(
    client,
    monkeypatch,
) -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-retry-translate",
            owner_id="local-dev",
            name="Retry translation",
            source_type="upload",
            source_url="/storage/uploads/project-retry-translate/clip.mp4",
            status="translation_failed",
            transcript_status="ready",
            translation_status="failed",
        )
        segment = TranscriptSegment(
            id="segment-retry-translate",
            project_id=project.id,
            speaker="Speaker A",
            start_ms=0,
            end_ms=600,
            original_text="Hello",
            translated_text="Stale translation",
        )
        word = TranscriptWord(
            id="word-retry-translate",
            project_id=project.id,
            position=1,
            start_ms=0,
            end_ms=600,
            original_text="Hello",
            translated_text="Stare tlumaczenie",
            keyword=False,
        )
        db.add_all([project, segment, word])
        db.commit()

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.translate_project_task.delay", delay_mock)

    response = client.post("/api/projects/project-retry-translate/translate")

    assert response.status_code == 202
    payload = response.json()
    delay_mock.assert_called_once_with(payload["job_id"], "project-retry-translate")

    detail = client.get("/api/projects/project-retry-translate")
    assert detail.status_code == 200
    assert detail.json()["translation_status"] == "queued"
    assert detail.json()["transcript_status"] == "ready"
    assert detail.json()["transcript_segments"] == [
        {
            "speaker": "Speaker A",
            "start_ms": 0,
            "end_ms": 600,
            "original_text": "Hello",
            "translated_text": "",
            "words": [],
        }
    ]
    assert detail.json()["transcript_words"] == [
        {
            "position": 1,
            "start_ms": 0,
            "end_ms": 600,
            "original_text": "Hello",
            "translated_text": "",
            "keyword": False,
        }
    ]


def test_transcribe_retry_endpoint_clears_stale_transcript_output_before_requeueing(
    client,
    monkeypatch,
) -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-retry-transcript",
            owner_id="local-dev",
            name="Retry transcript",
            source_type="upload",
            source_url="/storage/uploads/project-retry-transcript/clip.mp4",
            status="transcription_failed",
            transcript_status="failed",
            translation_status="not_started",
        )
        segment = TranscriptSegment(
            id="segment-retry-transcript",
            project_id=project.id,
            speaker="Speaker A",
            start_ms=0,
            end_ms=1000,
            original_text="Broken transcript",
            translated_text="",
        )
        word = TranscriptWord(
            id="word-retry-transcript",
            project_id=project.id,
            position=1,
            start_ms=0,
            end_ms=1000,
            original_text="Broken",
            translated_text="",
            keyword=False,
        )
        db.add_all([project, segment, word])
        db.commit()

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.transcribe_project_task.delay", delay_mock)

    response = client.post("/api/projects/project-retry-transcript/transcribe")

    assert response.status_code == 202
    payload = response.json()
    delay_mock.assert_called_once_with(payload["job_id"], "project-retry-transcript")

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-retry-transcript")
        saved_segments = db.query(TranscriptSegment).filter_by(project_id="project-retry-transcript").all()
        saved_words = db.query(TranscriptWord).filter_by(project_id="project-retry-transcript").all()

        assert saved_project is not None
        assert saved_project.status == "transcription_queued"
        assert saved_project.transcript_status == "queued"
        assert saved_segments == []
        assert saved_words == []


def test_translate_retry_endpoint_clears_only_translation_output_before_requeueing(
    client,
    monkeypatch,
) -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-retry-translation",
            owner_id="local-dev",
            name="Retry translation",
            source_type="upload",
            source_url="/storage/uploads/project-retry-translation/clip.mp4",
            status="translation_failed",
            transcript_status="ready",
            translation_status="failed",
        )
        segment = TranscriptSegment(
            id="segment-retry-translation",
            project_id=project.id,
            speaker="Speaker A",
            start_ms=0,
            end_ms=1000,
            original_text="Hello",
            translated_text="Stale translation",
        )
        word = TranscriptWord(
            id="word-retry-translation",
            project_id=project.id,
            position=1,
            start_ms=0,
            end_ms=1000,
            original_text="Hello",
            translated_text="Stare tlumaczenie",
            keyword=False,
        )
        db.add_all([project, segment, word])
        db.commit()

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.translate_project_task.delay", delay_mock)

    response = client.post("/api/projects/project-retry-translation/translate")

    assert response.status_code == 202
    payload = response.json()
    delay_mock.assert_called_once_with(payload["job_id"], "project-retry-translation")

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-retry-translation")
        saved_segment = db.get(TranscriptSegment, "segment-retry-translation")
        saved_word = db.get(TranscriptWord, "word-retry-translation")

        assert saved_project is not None
        assert saved_project.translation_status == "queued"
        assert saved_segment is not None
        assert saved_segment.original_text == "Hello"
        assert saved_segment.translated_text == ""
        assert saved_word is not None
        assert saved_word.original_text == "Hello"
        assert saved_word.translated_text == ""


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
        "active_job": None,
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
        "transcript_words": [],
    }


def test_transcription_only_completion_hides_translation_output_in_project_detail(
    client,
    monkeypatch,
) -> None:
    source_path = Path(_tmp_media_path("project-transcribed.mp4"))
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
        async def transcribe_translate(self, audio_bytes: bytes, **_: object) -> dict[str, object]:
            assert audio_bytes == b"audio"
            return {
                "words": [
                    {
                        "position": 1,
                        "start_ms": 0,
                        "end_ms": 1000,
                        "original_text": "Hello.",
                        "keyword": False,
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
            "original_text": "Hello.",
            "translated_text": "",
            "words": [],
        }
    ]


def test_translate_task_marks_project_failed_and_clears_translation_output(monkeypatch) -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-translate-invalid",
            owner_id="local-dev",
            name="Translate invalid",
            source_type="upload",
            source_url="/storage/uploads/project-translate-invalid/clip.mp4",
            target_language="pl",
            status="transcribed",
            transcript_status="ready",
            translation_status="queued",
        )
        segment = TranscriptSegment(
            id="segment-translate-invalid",
            project_id=project.id,
            speaker="Speaker A",
            start_ms=125,
            end_ms=950,
            original_text="Hello",
            translated_text="Stale translation",
        )
        word = TranscriptWord(
            id="word-translate-invalid",
            project_id=project.id,
            position=1,
            start_ms=125,
            end_ms=950,
            original_text="Hello",
            translated_text="Stare tlumaczenie",
            keyword=False,
        )
        job = PipelineJob(
            id="job-translate-invalid",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.translate_project",
        )
        db.add_all([project, segment, word, job])
        db.commit()

    class FakeGeminiClient:
        async def translate_segments(
            self,
            segments: list[dict[str, object]],
            target_language: str = "pl",
            **_: object,
        ) -> list[str]:
            assert target_language == "pl"
            assert len(segments) == 1
            raise ValueError("Unsupported translation item payload: {'oops': 'bad'}")

    monkeypatch.setattr("app.tasks.ai.GeminiClient", FakeGeminiClient)

    with pytest.raises(ValueError, match="Unsupported translation item payload"):
        translate_project("job-translate-invalid", "project-translate-invalid")

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-translate-invalid")
        saved_segment = db.get(TranscriptSegment, "segment-translate-invalid")
        saved_word = db.get(TranscriptWord, "word-translate-invalid")
        saved_job = db.get(PipelineJob, "job-translate-invalid")

        assert saved_project is not None
        assert saved_project.status == "translation_failed"
        assert saved_project.transcript_status == "ready"
        assert saved_project.translation_status == "failed"
        assert saved_segment is not None
        assert saved_segment.translated_text == ""
        assert saved_word is not None
        assert saved_word.translated_text == ""
        assert saved_job is not None
        assert saved_job.state == "failure"


@pytest.mark.parametrize("translation_status", ["queued", "in_progress", "ready"])
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


@pytest.mark.parametrize("translation_status", ["queued", "in_progress", "ready"])
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
    assert "Translation" in response.json()["detail"]
    delay_mock.assert_not_called()


def test_translate_task_rejects_when_transcript_is_not_ready() -> None:
    source_path = Path(_tmp_media_path("project-translate-only.mp4"))
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
        assert saved_project.translation_status == "not_started"
        assert saved_segments == []


def test_translate_task_updates_existing_words_and_rebuilds_segments(monkeypatch) -> None:
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
        word = TranscriptWord(
            id="word-translate-ready-1",
            project_id=project.id,
            position=1,
            start_ms=125,
            end_ms=950,
            original_text="Hello",
            translated_text="",
            keyword=False,
        )
        job = PipelineJob(
            id="job-translate-ready",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.translate_project",
        )
        db.add_all([project, segment, word, job])
        db.commit()

    class FakeGeminiClient:
        async def translate_segments(
            self,
            segments: list[dict[str, object]],
            target_language: str = "pl",
            **_: object,
        ) -> list[str]:
            assert target_language == "pl"
            assert segments == [
                {
                    "start_ms": 125,
                    "end_ms": 950,
                    "original_text": "Hello",
                }
            ]
            return ["Czesc"]

    monkeypatch.setattr("app.tasks.ai.GeminiClient", FakeGeminiClient)

    result = translate_project("job-translate-ready", "project-translate-ready")

    assert result == {"project_id": "project-translate-ready", "status": "translated"}

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-translate-ready")
        saved_segment = (
            db.query(TranscriptSegment)
            .filter_by(project_id="project-translate-ready")
            .order_by(TranscriptSegment.start_ms.asc())
            .first()
        )
        saved_word = db.get(TranscriptWord, "word-translate-ready-1")

        assert saved_project is not None
        assert saved_project.status == "translated"
        assert saved_project.transcript_status == "ready"
        assert saved_project.translation_status == "ready"
        assert saved_segment is not None
        assert saved_segment.speaker == "Speaker A"
        assert saved_segment.start_ms == 125
        assert saved_segment.end_ms == 950
        assert saved_segment.original_text == "Hello"
        assert saved_segment.translated_text == "Czesc"
        assert saved_word is not None
        assert saved_word.translated_text == "Czesc"


def test_translate_task_maps_segment_translation_back_to_words(monkeypatch) -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-translate-segmented",
            owner_id="local-dev",
            name="Translate segmented",
            source_type="upload",
            source_url="/storage/uploads/project-translate-segmented/clip.mp4",
            target_language="pl",
            status="transcribed",
            transcript_status="ready",
            translation_status="queued",
        )
        words = [
            TranscriptWord(
                id="word-translate-segmented-1",
                project_id=project.id,
                position=1,
                start_ms=125,
                end_ms=450,
                original_text="Hello",
                translated_text="",
                keyword=False,
            ),
            TranscriptWord(
                id="word-translate-segmented-2",
                project_id=project.id,
                position=2,
                start_ms=451,
                end_ms=950,
                original_text="world",
                translated_text="",
                keyword=False,
            ),
        ]
        job = PipelineJob(
            id="job-translate-segmented",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.translate_project",
        )
        db.add(project)
        db.add_all(words)
        db.add(job)
        db.commit()

    class FakeGeminiClient:
        async def translate_segments(
            self,
            segments: list[dict[str, object]],
            target_language: str = "pl",
            **_: object,
        ) -> list[str]:
            assert target_language == "pl"
            assert segments == [
                {
                    "start_ms": 125,
                    "end_ms": 950,
                    "original_text": "Hello world",
                }
            ]
            return ["Czesc swiecie"]

    monkeypatch.setattr("app.tasks.ai.GeminiClient", FakeGeminiClient)

    result = translate_project("job-translate-segmented", "project-translate-segmented")

    assert result == {"project_id": "project-translate-segmented", "status": "translated"}

    with SessionLocal() as db:
        saved_words = (
            db.query(TranscriptWord)
            .filter_by(project_id="project-translate-segmented")
            .order_by(TranscriptWord.position.asc())
            .all()
        )
        saved_segment = (
            db.query(TranscriptSegment)
            .filter_by(project_id="project-translate-segmented")
            .order_by(TranscriptSegment.start_ms.asc())
            .first()
        )

        assert [word.translated_text for word in saved_words] == ["Czesc", "swiecie"]
        assert saved_segment is not None
        assert saved_segment.translated_text == "Czesc swiecie"
