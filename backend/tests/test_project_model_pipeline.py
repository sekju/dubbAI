from app.db.session import SessionLocal
from app.models.project import Project
from app.services.projects import serialize_library_project, serialize_project


def test_project_persists_languages_and_stage_statuses() -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-pipeline",
            owner_id="local-dev",
            name="Pipeline demo",
            source_type="upload",
            source_url="/storage/uploads/pipeline-demo.mp4",
            status="processing",
            source_language="en",
            target_language="pl",
            transcript_status="ready",
            translation_status="in_progress",
            dubbing_status="failed",
        )

        db.add(project)
        db.commit()
        db.expire_all()

        saved_project = db.get(Project, "project-pipeline")
        assert saved_project is not None
        assert saved_project.source_language == "en"
        assert saved_project.target_language == "pl"
        assert saved_project.transcript_status == "ready"
        assert saved_project.translation_status == "in_progress"
        assert saved_project.dubbing_status == "failed"


def test_project_and_library_serializers_include_languages_and_stage_statuses() -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-serializer",
            owner_id="local-dev",
            name="Serializer demo",
            source_type="url",
            source_url="https://example.com/video",
            status="queued",
            source_language="ja",
            target_language="en",
            transcript_status="in_progress",
            translation_status="ready",
            dubbing_status="not_started",
        )

        db.add(project)
        db.commit()

        project_payload = serialize_project(db, project).model_dump()
        library_payload = serialize_library_project(project).model_dump()

        assert project_payload["source_language"] == "ja"
        assert project_payload["target_language"] == "en"
        assert project_payload["transcript_status"] == "in_progress"
        assert project_payload["translation_status"] == "ready"
        assert project_payload["dubbing_status"] == "not_started"

        assert library_payload["source_language"] == "ja"
        assert library_payload["target_language"] == "en"
        assert library_payload["transcript_status"] == "in_progress"
        assert library_payload["translation_status"] == "ready"
        assert library_payload["dubbing_status"] == "not_started"
