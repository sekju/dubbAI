from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import PipelineJob
from app.models.project import Project
from app.models.transcript import TranscriptSegment
from app.schemas.job import JobStatusResponse
from app.schemas.project import ProjectResponse
from app.schemas.transcript import TranscriptChunk

INGEST_QUEUE = "app.tasks.ingest.ingest_source"
TRANSCRIBE_QUEUE = "app.tasks.ai.transcribe_project"


def _serialize_segments(segments: list[TranscriptSegment]) -> list[TranscriptChunk]:
    return [
        TranscriptChunk(
            speaker=segment.speaker,
            start_ms=segment.start_ms,
            end_ms=segment.end_ms,
            original_text=segment.original_text,
            translated_text=segment.translated_text,
            words=[],
        )
        for segment in segments
    ]


def serialize_project(db: Session, project: Project) -> ProjectResponse:
    segments = db.scalars(
        select(TranscriptSegment)
        .where(TranscriptSegment.project_id == project.id)
        .order_by(TranscriptSegment.start_ms.asc())
    ).all()
    return ProjectResponse(
        id=project.id,
        name=project.name,
        source_type=project.source_type,
        source_url=project.source_url,
        status=project.status,
        transcript_segments=_serialize_segments(segments),
    )


def create_project_with_job(
    db: Session,
    *,
    name: str,
    source_type: str,
    source_url: str,
    status_value: str,
) -> JobStatusResponse:
    project = Project(
        id=str(uuid4()),
        owner_id="local-dev",
        name=name,
        source_type=source_type,
        source_url=source_url,
        status=status_value,
    )
    job = PipelineJob(
        id=str(uuid4()),
        project_id=project.id,
        state="queued",
        progress=0,
        queue=INGEST_QUEUE,
    )
    db.add(project)
    db.flush()
    db.add(job)
    db.commit()
    return JobStatusResponse(
        job_id=job.id,
        project_id=project.id,
        state=job.state,
        progress=job.progress,
        queue=job.queue,
    )


def create_job_for_project(db: Session, *, project_id: str, queue: str) -> JobStatusResponse:
    project = get_project_model_or_404(db, project_id)
    if queue == TRANSCRIBE_QUEUE:
        project.status = "transcription_queued"

    job = PipelineJob(
        id=str(uuid4()),
        project_id=project.id,
        state="queued",
        progress=0,
        queue=queue,
    )
    db.add(project)
    db.add(job)
    db.commit()
    return JobStatusResponse(
        job_id=job.id,
        project_id=project.id,
        state=job.state,
        progress=job.progress,
        queue=job.queue,
    )


def list_projects(db: Session) -> list[ProjectResponse]:
    projects = db.scalars(select(Project).order_by(Project.name.asc())).all()
    return [serialize_project(db, project) for project in projects]


def get_project_or_404(db: Session, project_id: str) -> ProjectResponse:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return serialize_project(db, project)


def get_project_model_or_404(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def get_job_or_404(db: Session, job_id: str) -> JobStatusResponse:
    job = db.get(PipelineJob, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobStatusResponse(
        job_id=job.id,
        project_id=job.project_id,
        state=job.state,
        progress=job.progress,
        queue=job.queue,
    )
