import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, inspect

import app.main as main_module
from app.db.session import SessionLocal
from app.models.job import PipelineJob
from app.models.project import Project
from app.models.transcript import TranscriptWord
from app.services.projects import serialize_library_project, serialize_project


def _tmp_schema_path(filename: str) -> Path:
    path = Path(__file__).resolve().parents[2] / "storage" / "test-suite" / "tmp-schema" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    return path


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
        library_payload = serialize_library_project(db, project).model_dump()

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


def test_project_and_library_serializers_include_active_job_context() -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-active-job",
            owner_id="local-dev",
            name="Active job demo",
            source_type="upload",
            source_url="/storage/uploads/project-active-job/demo.mp4",
            status="transcription_queued",
            source_language="en",
            target_language="pl",
            transcript_status="queued",
            translation_status="not_started",
            dubbing_status="not_started",
        )
        job = PipelineJob(
            id="job-active-project",
            project_id=project.id,
            state="started",
            progress=45,
            queue="app.tasks.ai.transcribe_project",
        )

        db.add(project)
        db.add(job)
        db.commit()

        project_payload = serialize_project(db, project).model_dump()
        library_payload = serialize_library_project(db, project).model_dump()

        assert project_payload["active_job"] == {
            "job_id": "job-active-project",
            "project_id": "project-active-job",
            "state": "started",
            "progress": 45,
            "queue": "app.tasks.ai.transcribe_project",
        }
        assert library_payload["active_job"] == {
            "job_id": "job-active-project",
            "project_id": "project-active-job",
            "state": "started",
            "progress": 45,
            "queue": "app.tasks.ai.transcribe_project",
        }


def test_project_serializer_heals_stale_queued_transcript_when_segments_exist() -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-stale-transcript",
            owner_id="local-dev",
            name="Stale transcript",
            source_type="upload",
            source_url="/storage/uploads/project-stale-transcript/demo.mp4",
            status="transcribed",
            transcript_status="queued",
            translation_status="not_started",
            dubbing_status="not_started",
        )

        db.add(project)
        db.flush()
        db.execute(
            main_module.text(
                """
                INSERT INTO transcript_segments (
                    id, project_id, speaker, start_ms, end_ms, original_text, translated_text
                ) VALUES (
                    :id, :project_id, :speaker, :start_ms, :end_ms, :original_text, :translated_text
                )
                """
            ),
            {
                "id": "project-stale-transcript-0",
                "project_id": project.id,
                "speaker": "Speaker A",
                "start_ms": 0,
                "end_ms": 1000,
                "original_text": "Hello again",
                "translated_text": "",
            },
        )
        db.commit()

        payload = serialize_project(db, project).model_dump()
        db.expire_all()
        saved_project = db.get(Project, project.id)

        assert payload["transcript_status"] == "ready"
        assert payload["active_job"] is None
        assert saved_project is not None
        assert saved_project.transcript_status == "ready"


def test_project_serializer_includes_transcript_words() -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-word-payload",
            owner_id="local-dev",
            name="Word payload",
            source_type="upload",
            source_url="/storage/uploads/project-word-payload/demo.mp4",
            status="transcribed",
            transcript_status="ready",
            translation_status="ready",
            dubbing_status="not_started",
        )
        word = TranscriptWord(
            id="project-word-payload-word-1",
            project_id=project.id,
            position=1,
            start_ms=120,
            end_ms=480,
            original_text="Hello",
            translated_text="Czesc",
            keyword=True,
        )
        db.add_all([project, word])
        db.commit()

        payload = serialize_project(db, project).model_dump()

    assert payload["transcript_words"] == [
        {
            "position": 1,
            "start_ms": 120,
            "end_ms": 480,
            "original_text": "Hello",
            "translated_text": "Czesc",
            "keyword": True,
        }
    ]


def test_project_serializer_flags_legacy_placeholder_transcript_as_failed() -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-legacy-placeholder",
            owner_id="local-dev",
            name="Legacy placeholder",
            source_type="upload",
            source_url="/storage/uploads/project-legacy-placeholder/demo.mp4",
            status="transcribed",
            transcript_status="ready",
            translation_status="not_started",
            dubbing_status="not_started",
        )
        db.add(project)
        db.flush()
        db.execute(
            main_module.text(
                """
                INSERT INTO transcript_segments (
                    id, project_id, speaker, start_ms, end_ms, original_text, translated_text
                ) VALUES (
                    :id, :project_id, :speaker, :start_ms, :end_ms, :original_text, :translated_text
                )
                """
            ),
            {
                "id": "project-legacy-placeholder-0",
                "project_id": project.id,
                "speaker": "Speaker A",
                "start_ms": 0,
                "end_ms": 1000,
                "original_text": "Transcript placeholder for legacy import",
                "translated_text": "",
            },
        )
        db.commit()

        payload = serialize_project(db, project).model_dump()
        db.expire_all()
        saved_project = db.get(Project, project.id)

    assert payload["transcript_status"] == "failed"
    assert payload["status"] == "transcription_failed"
    assert saved_project is not None
    assert saved_project.transcript_status == "failed"


def test_project_serializer_flags_malformed_translation_payload_as_failed() -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-legacy-translation",
            owner_id="local-dev",
            name="Legacy translation",
            source_type="upload",
            source_url="/storage/uploads/project-legacy-translation/demo.mp4",
            status="translated",
            transcript_status="ready",
            translation_status="ready",
            dubbing_status="not_started",
        )
        word = TranscriptWord(
            id="project-legacy-translation-word-1",
            project_id=project.id,
            position=1,
            start_ms=120,
            end_ms=480,
            original_text="Hello",
            translated_text="{'translated_text': 'Czesc'}",
            keyword=False,
        )
        db.add_all([project, word])
        db.commit()

        payload = serialize_project(db, project).model_dump()
        db.expire_all()
        saved_project = db.get(Project, project.id)

    assert payload["translation_status"] == "failed"
    assert saved_project is not None
    assert saved_project.translation_status == "failed"


def test_ensure_project_schema_adds_missing_pipeline_columns_for_existing_projects_table() -> None:
    db_path = _tmp_schema_path("legacy-projects.db")
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE projects (
                id VARCHAR(64) PRIMARY KEY,
                owner_id VARCHAR(64) NOT NULL,
                name VARCHAR(120) NOT NULL,
                source_type VARCHAR(32) NOT NULL,
                source_url VARCHAR(2048),
                status VARCHAR(32) NOT NULL,
                folder_id VARCHAR(64)
            )
            """
        )
        connection.commit()

    engine = create_engine(f"sqlite:///{db_path}")
    try:
        main_module.ensure_project_schema(engine)
        columns = {column["name"] for column in inspect(engine).get_columns("projects")}
    finally:
        engine.dispose()

    assert {
        "source_language",
        "target_language",
        "transcript_status",
        "translation_status",
        "dubbing_status",
    }.issubset(columns)


def test_ensure_project_schema_backfills_transcript_status_from_legacy_status() -> None:
    db_path = _tmp_schema_path("legacy-projects-backfill.db")
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE projects (
                id VARCHAR(64) PRIMARY KEY,
                owner_id VARCHAR(64) NOT NULL,
                name VARCHAR(120) NOT NULL,
                source_type VARCHAR(32) NOT NULL,
                source_url VARCHAR(2048),
                status VARCHAR(32) NOT NULL,
                folder_id VARCHAR(64)
            )
            """
        )
        connection.executemany(
            """
            INSERT INTO projects (id, owner_id, name, source_type, source_url, status, folder_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("project-ready", "local-dev", "Ready", "upload", None, "transcribed", None),
                (
                    "project-failed",
                    "local-dev",
                    "Failed",
                    "upload",
                    None,
                    "transcription_failed",
                    None,
                ),
            ],
        )
        connection.commit()

    engine = create_engine(f"sqlite:///{db_path}")
    try:
        main_module.ensure_project_schema(engine)
        with engine.connect() as connection:
            rows = connection.execute(
                main_module.text(
                    """
                    SELECT id, transcript_status, translation_status, dubbing_status
                    FROM projects
                    ORDER BY id
                    """
                )
            ).fetchall()
    finally:
        engine.dispose()

    assert rows == [
        ("project-failed", "failed", "not_started", "not_started"),
        ("project-ready", "ready", "not_started", "not_started"),
    ]
