from unittest.mock import Mock

from app.db.session import SessionLocal
from app.models.project import Project
from app.models.transcript import TranscriptSegment


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
