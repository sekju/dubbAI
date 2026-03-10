from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.api.router import api_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.models import PipelineJob, Project, TranscriptSegment, User

settings = get_settings()


def ensure_project_schema(db_engine: Engine) -> None:
    inspector = inspect(db_engine)
    if not inspector.has_table("projects"):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("projects")}
    missing_columns = {
        "source_language": "ALTER TABLE projects ADD COLUMN source_language VARCHAR(32)",
        "target_language": "ALTER TABLE projects ADD COLUMN target_language VARCHAR(32)",
        "transcript_status": (
            "ALTER TABLE projects ADD COLUMN transcript_status "
            "VARCHAR(32) NOT NULL DEFAULT 'not_started'"
        ),
        "translation_status": (
            "ALTER TABLE projects ADD COLUMN translation_status "
            "VARCHAR(32) NOT NULL DEFAULT 'not_started'"
        ),
        "dubbing_status": (
            "ALTER TABLE projects ADD COLUMN dubbing_status "
            "VARCHAR(32) NOT NULL DEFAULT 'not_started'"
        ),
    }

    with db_engine.begin() as connection:
        for column_name, ddl in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_project_schema(engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.mount("/storage", StaticFiles(directory=settings.upload_directory.parent), name="storage")
