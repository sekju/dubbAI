from pathlib import Path
from unittest.mock import Mock

import pytest

from app.db.session import SessionLocal
from app.models.job import PipelineJob
from app.models.project import Project
from app.models.transcript import TranscriptSegment, TranscriptWord
from app.tasks.ai import transcribe_project


def _tmp_media_path(filename: str) -> Path:
    path = Path(__file__).resolve().parents[2] / "storage" / "test-suite" / "tmp-media" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _expected_project_payload(
    *,
    project_id: str,
    name: str,
    source_type: str,
    source_url: str,
    status: str,
    transcript_status: str = "not_started",
) -> dict[str, object]:
    return {
        "id": project_id,
        "name": name,
        "source_type": source_type,
        "source_url": source_url,
        "source_language": None,
        "target_language": None,
        "status": status,
        "transcript_status": transcript_status,
        "translation_status": "not_started",
        "dubbing_status": "not_started",
        "active_job": None,
        "transcript_segments": [],
        "transcript_words": [],
    }


def test_upload_project_creates_persisted_project_and_job(client) -> None:
    response = client.post(
        "/api/projects/upload",
        data={"name": "Clip upload"},
        files={"file": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["state"] == "queued"
    assert payload["project_id"]
    assert payload["job_id"]

    projects = client.get("/api/projects")
    assert projects.status_code == 200
    assert projects.json() == [
        _expected_project_payload(
            project_id=payload["project_id"],
            name="Clip upload",
            source_type="upload",
            source_url=f"/storage/uploads/{payload['project_id']}/clip.mp4",
            status="uploaded",
        )
    ]

    job = client.get(f"/api/jobs/{payload['job_id']}")
    assert job.status_code == 200
    assert job.json() == {
        "job_id": payload["job_id"],
        "project_id": payload["project_id"],
        "state": "queued",
        "progress": 0,
        "queue": "app.tasks.ingest.ingest_source",
    }


def test_url_project_creates_detail_record(client) -> None:
    response = client.post(
        "/api/projects/import",
        json={"name": "Remote clip", "source_url": "https://example.com/video"},
    )

    assert response.status_code == 202
    payload = response.json()

    detail = client.get(f"/api/projects/{payload['project_id']}")

    assert detail.status_code == 200
    assert detail.json() == _expected_project_payload(
        project_id=payload["project_id"],
        name="Remote clip",
        source_type="url",
        source_url="https://example.com/video",
        status="queued",
    )


def test_project_intake_persists_auto_language_and_gemini_controls(client) -> None:
    response = client.post(
        "/api/projects/import",
        json={
            "name": "Controlled clip",
            "source_url": "https://example.com/video",
            "source_language": "auto",
            "target_language": "en",
            "gemini_model_text": "gemini-2.5-flash",
            "gemini_thinking_mode": "budget",
            "gemini_thinking_budget": 2048,
            "gemini_max_output_tokens": 65536,
            "gemini_structured_output": True,
        },
    )

    assert response.status_code == 202
    payload = response.json()

    with SessionLocal() as db:
        project = db.get(Project, payload["project_id"])

        assert project is not None
        assert project.source_language == "auto"
        assert project.target_language == "en"
        assert project.gemini_model_text == "gemini-2.5-flash"
        assert project.gemini_thinking_mode == "budget"
        assert project.gemini_thinking_budget == 2048
        assert project.gemini_max_output_tokens == 65536
        assert project.gemini_structured_output is True


def test_transcribe_endpoint_creates_ai_job_and_dispatches_task(client, monkeypatch) -> None:
    create_response = client.post(
        "/api/projects/import",
        json={"name": "Transcribe me", "source_url": "https://example.com/video"},
    )
    project_id = create_response.json()["project_id"]

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


def test_transcribe_task_sets_transcript_status_in_progress_and_ready(monkeypatch) -> None:
    source_path = _tmp_media_path("project-transcribe-success.mp4")
    source_path.write_bytes(b"video")
    observed_statuses: list[tuple[str, str]] = []

    with SessionLocal() as db:
        project = Project(
            id="project-transcribe-success",
            owner_id="local-dev",
            name="Task success",
            source_type="upload",
            source_url=str(source_path),
            status="transcription_queued",
            transcript_status="queued",
        )
        job = PipelineJob(
            id="job-transcribe-success",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.transcribe_project",
        )
        db.add_all([project, job])
        db.commit()

    def fake_extract_audio(source: Path, audio_path: Path) -> None:
        assert source == source_path
        with SessionLocal() as verify_db:
            verify_project = verify_db.get(Project, "project-transcribe-success")
            assert verify_project is not None
            observed_statuses.append((verify_project.status, verify_project.transcript_status))
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
                        "end_ms": 450,
                        "original_text": "Hello",
                        "keyword": False,
                    },
                    {
                        "position": 2,
                        "start_ms": 451,
                        "end_ms": 1000,
                        "original_text": "world.",
                        "keyword": True,
                    }
                ]
            }

    monkeypatch.setattr("app.tasks.ai.extract_audio", fake_extract_audio)
    monkeypatch.setattr("app.tasks.ai.GeminiClient", FakeGeminiClient)

    result = transcribe_project("job-transcribe-success", "project-transcribe-success")

    assert result == {"project_id": "project-transcribe-success", "status": "transcribed"}
    assert observed_statuses == [("transcribing", "in_progress")]

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-transcribe-success")
        saved_job = db.get(PipelineJob, "job-transcribe-success")
        saved_segments = db.query(TranscriptSegment).filter_by(project_id="project-transcribe-success").all()
        saved_words = (
            db.query(TranscriptWord)
            .filter_by(project_id="project-transcribe-success")
            .order_by(TranscriptWord.position.asc())
            .all()
        )

        assert saved_project is not None
        assert saved_project.status == "transcribed"
        assert saved_project.transcript_status == "ready"
        assert saved_job is not None
        assert saved_job.state == "success"
        assert [word.original_text for word in saved_words] == ["Hello", "world."]
        assert saved_segments


def test_transcribe_task_sets_transcript_status_failed_on_error(monkeypatch) -> None:
    source_path = _tmp_media_path("project-transcribe-failure.mp4")
    source_path.write_bytes(b"video")
    observed_statuses: list[tuple[str, str]] = []

    with SessionLocal() as db:
        project = Project(
            id="project-transcribe-failure",
            owner_id="local-dev",
            name="Task failure",
            source_type="upload",
            source_url=str(source_path),
            status="transcription_queued",
            transcript_status="queued",
        )
        job = PipelineJob(
            id="job-transcribe-failure",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.transcribe_project",
        )
        db.add_all([project, job])
        db.commit()

    def failing_extract_audio(_: Path, __: Path) -> None:
        with SessionLocal() as verify_db:
            verify_project = verify_db.get(Project, "project-transcribe-failure")
            assert verify_project is not None
            observed_statuses.append((verify_project.status, verify_project.transcript_status))
        raise RuntimeError("extract failed")

    monkeypatch.setattr("app.tasks.ai.extract_audio", failing_extract_audio)

    with pytest.raises(RuntimeError, match="extract failed"):
        transcribe_project("job-transcribe-failure", "project-transcribe-failure")

    assert observed_statuses == [("transcribing", "in_progress")]

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-transcribe-failure")
        saved_job = db.get(PipelineJob, "job-transcribe-failure")

        assert saved_project is not None
        assert saved_project.status == "transcription_failed"
        assert saved_project.transcript_status == "failed"
        assert saved_job is not None
        assert saved_job.state == "failure"


def test_transcribe_task_fails_when_gemini_returns_no_segments(monkeypatch) -> None:
    source_path = _tmp_media_path("project-transcribe-empty.mp4")
    source_path.write_bytes(b"video")

    with SessionLocal() as db:
        project = Project(
            id="project-transcribe-empty-gemini",
            owner_id="local-dev",
            name="Empty Gemini transcript",
            source_type="upload",
            source_url=str(source_path),
            status="transcription_queued",
            transcript_status="queued",
        )
        job = PipelineJob(
            id="job-transcribe-empty-gemini",
            project_id=project.id,
            state="queued",
            progress=0,
            queue="app.tasks.ai.transcribe_project",
        )
        db.add_all([project, job])
        db.commit()

    def fake_extract_audio(source: Path, audio_path: Path) -> None:
        assert source == source_path
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        audio_path.write_bytes(b"audio")

    class FakeGeminiClient:
        async def transcribe_translate(self, audio_bytes: bytes, **_: object) -> dict[str, object]:
            assert audio_bytes == b"audio"
            return {"words": []}

    monkeypatch.setattr("app.tasks.ai.extract_audio", fake_extract_audio)
    monkeypatch.setattr("app.tasks.ai.GeminiClient", FakeGeminiClient)

    with pytest.raises(RuntimeError, match="returned no transcript words"):
        transcribe_project("job-transcribe-empty-gemini", "project-transcribe-empty-gemini")

    with SessionLocal() as db:
        saved_project = db.get(Project, "project-transcribe-empty-gemini")
        saved_job = db.get(PipelineJob, "job-transcribe-empty-gemini")
        saved_segments = db.query(TranscriptSegment).filter_by(project_id="project-transcribe-empty-gemini").all()
        saved_words = db.query(TranscriptWord).filter_by(project_id="project-transcribe-empty-gemini").all()

        assert saved_project is not None
        assert saved_project.status == "transcription_failed"
        assert saved_project.transcript_status == "failed"
        assert saved_job is not None
        assert saved_job.state == "failure"
        assert saved_segments == []
        assert saved_words == []
