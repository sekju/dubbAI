from uuid import uuid4

from fastapi import APIRouter, status

from app.schemas.job import ExportRequest, JobStatusResponse

router = APIRouter()


@router.post("", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_export(payload: ExportRequest) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=str(uuid4()),
        project_id=payload.project_id,
        state="queued",
        progress=0,
        queue="app.tasks.render.render_project",
    )
