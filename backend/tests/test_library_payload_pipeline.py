from app.db.session import SessionLocal
from app.models.project import Project


def test_library_payload_includes_languages_and_stage_statuses(client) -> None:
    with SessionLocal() as db:
        db.add(
            Project(
                id="project-library-pipeline",
                owner_id="local-dev",
                name="Pipeline payload",
                source_type="url",
                source_url="https://example.com/pipeline",
                status="processing",
                source_language="en",
                target_language="pl",
                transcript_status="ready",
                translation_status="in_progress",
                dubbing_status="not_started",
            )
        )
        db.commit()

    response = client.get("/api/library")

    assert response.status_code == 200
    assert response.json()["projects"] == [
        {
            "id": "project-library-pipeline",
            "name": "Pipeline payload",
            "status": "processing",
            "source_type": "url",
            "source_url": "https://example.com/pipeline",
            "source_language": "en",
            "target_language": "pl",
            "transcript_status": "ready",
            "translation_status": "in_progress",
            "dubbing_status": "not_started",
            "next_action": "open_theater",
            "folder_id": None,
        }
    ]


def test_library_payload_derives_next_action_from_pipeline_state(client) -> None:
    with SessionLocal() as db:
        db.add_all(
            [
                Project(
                    id="project-transcribe",
                    owner_id="local-dev",
                    name="A transcribe",
                    source_type="upload",
                    source_url="/storage/uploads/transcribe.mp4",
                    status="queued",
                    transcript_status="not_started",
                    translation_status="not_started",
                    dubbing_status="not_started",
                ),
                Project(
                    id="project-translate",
                    owner_id="local-dev",
                    name="B translate",
                    source_type="upload",
                    source_url="/storage/uploads/translate.mp4",
                    status="transcribed",
                    transcript_status="ready",
                    translation_status="not_started",
                    dubbing_status="not_started",
                ),
                Project(
                    id="project-open-theater",
                    owner_id="local-dev",
                    name="C open theater",
                    source_type="upload",
                    source_url="/storage/uploads/open-theater.mp4",
                    status="translated",
                    transcript_status="ready",
                    translation_status="ready",
                    dubbing_status="not_started",
                ),
                Project(
                    id="project-retry",
                    owner_id="local-dev",
                    name="D retry",
                    source_type="upload",
                    source_url="/storage/uploads/retry.mp4",
                    status="translation_failed",
                    transcript_status="ready",
                    translation_status="failed",
                    dubbing_status="not_started",
                ),
            ]
        )
        db.commit()

    response = client.get("/api/library")

    assert response.status_code == 200
    assert {
        project["id"]: project["next_action"] for project in response.json()["projects"]
    } == {
        "project-transcribe": "transcribe",
        "project-translate": "translate",
        "project-open-theater": "open_theater",
        "project-retry": "retry",
    }
