from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.job import JobStatusResponse
from app.schemas.project import ProjectImportRequest, ProjectResponse
from app.services.projects import (
    create_job_for_project,
    create_project_with_job,
    delete_project,
    get_project_model_or_404,
    get_project_or_404,
    list_projects,
)
from app.tasks.ai import transcribe_project as transcribe_project_task
from app.tasks.ai import translate_project as translate_project_task

router = APIRouter()


@router.get("", response_model=list[ProjectResponse])
async def get_projects(db: Session = Depends(get_db)) -> list[ProjectResponse]:
    return list_projects(db)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: Session = Depends(get_db)) -> ProjectResponse:
    return get_project_or_404(db, project_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project(project_id: str, db: Session = Depends(get_db)) -> Response:
    delete_project(db, project_id=project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def import_project(
    payload: ProjectImportRequest,
    db: Session = Depends(get_db),
) -> JobStatusResponse:
    return create_project_with_job(
        db,
        name=payload.name,
        source_type="url",
        source_url=payload.source_url,
        source_language=payload.source_language,
        target_language=payload.target_language,
        gemini_model_text=payload.gemini_model_text,
        gemini_thinking_mode=payload.gemini_thinking_mode,
        gemini_thinking_budget=payload.gemini_thinking_budget,
        gemini_max_output_tokens=payload.gemini_max_output_tokens,
        gemini_structured_output=payload.gemini_structured_output,
        status_value="queued",
    )


@router.post("/upload", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_project(
    name: str = Form(...),
    source_language: str | None = Form(None),
    target_language: str | None = Form(None),
    gemini_model_text: str | None = Form(None),
    gemini_thinking_mode: str | None = Form(None),
    gemini_thinking_budget: int | None = Form(None),
    gemini_max_output_tokens: int | None = Form(None),
    gemini_structured_output: bool | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> JobStatusResponse:
    project_job = create_project_with_job(
        db,
        name=name,
        source_type="upload",
        source_url="pending",
        source_language=source_language,
        target_language=target_language,
        gemini_model_text=gemini_model_text,
        gemini_thinking_mode=gemini_thinking_mode,
        gemini_thinking_budget=gemini_thinking_budget,
        gemini_max_output_tokens=gemini_max_output_tokens,
        gemini_structured_output=gemini_structured_output,
        status_value="uploaded",
    )
    settings = get_settings()
    destination = settings.upload_directory / project_job.project_id / file.filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(await file.read())

    project = get_project_model_or_404(db, project_job.project_id)
    project.source_url = f"/storage/uploads/{project_job.project_id}/{file.filename}"
    db.add(project)
    db.commit()
    return project_job


@router.post("/{project_id}/transcribe", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_transcription(
    project_id: str,
    db: Session = Depends(get_db),
) -> JobStatusResponse:
    job = create_job_for_project(db, project_id=project_id, queue="app.tasks.ai.transcribe_project")
    transcribe_project_task.delay(job.job_id, project_id)
    return job


@router.post("/{project_id}/translate", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_translation(
    project_id: str,
    db: Session = Depends(get_db),
) -> JobStatusResponse:
    job = create_job_for_project(db, project_id=project_id, queue="app.tasks.ai.translate_project")
    translate_project_task.delay(job.job_id, project_id)
    return job
