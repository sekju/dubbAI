import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, inspect

import app.main as main_module
from app.db.session import SessionLocal
from app.models.project import Project
from app.models.transcript import TranscriptWord


def _tmp_schema_path(filename: str) -> Path:
    path = Path(__file__).resolve().parents[2] / "storage" / "test-suite" / "tmp-schema" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    return path


def test_transcript_word_persists_word_level_timing_and_keyword_fields() -> None:
    with SessionLocal() as db:
        project = Project(
            id="project-word-model",
            owner_id="local-dev",
            name="Word model demo",
            source_type="upload",
            source_url="/storage/uploads/project-word-model/demo.mp4",
            status="transcribed",
            transcript_status="ready",
            translation_status="ready",
        )
        word = TranscriptWord(
            id="word-1",
            project_id=project.id,
            position=1,
            start_ms=681,
            end_ms=1321,
            original_text="Let's",
            translated_text="Zrobmy",
            keyword=False,
        )

        db.add(project)
        db.add(word)
        db.commit()
        db.expire_all()

        saved_word = db.get(TranscriptWord, "word-1")

        assert saved_word is not None
        assert saved_word.project_id == "project-word-model"
        assert saved_word.position == 1
        assert saved_word.start_ms == 681
        assert saved_word.end_ms == 1321
        assert saved_word.original_text == "Let's"
        assert saved_word.translated_text == "Zrobmy"
        assert saved_word.keyword is False


def test_ensure_transcript_word_schema_adds_missing_table_for_existing_dev_db() -> None:
    db_path = _tmp_schema_path("legacy-transcript.db")
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
                folder_id VARCHAR(64),
                source_language VARCHAR(32),
                target_language VARCHAR(32),
                transcript_status VARCHAR(32) NOT NULL DEFAULT 'not_started',
                translation_status VARCHAR(32) NOT NULL DEFAULT 'not_started',
                dubbing_status VARCHAR(32) NOT NULL DEFAULT 'not_started'
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE transcript_segments (
                id VARCHAR(64) PRIMARY KEY,
                project_id VARCHAR(64) NOT NULL,
                speaker VARCHAR(64) NOT NULL,
                start_ms INTEGER NOT NULL,
                end_ms INTEGER NOT NULL,
                original_text TEXT NOT NULL,
                translated_text TEXT NOT NULL
            )
            """
        )
        connection.commit()

    engine = create_engine(f"sqlite:///{db_path}")
    try:
        main_module.ensure_transcript_word_schema(engine)
        tables = set(inspect(engine).get_table_names())
        columns = {
            column["name"] for column in inspect(engine).get_columns("transcript_words")
        }
    finally:
        engine.dispose()

    assert "transcript_words" in tables
    assert {
        "id",
        "project_id",
        "position",
        "start_ms",
        "end_ms",
        "original_text",
        "translated_text",
        "keyword",
    }.issubset(columns)
