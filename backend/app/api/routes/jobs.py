from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.job import JobStatusResponse
from app.services.projects import get_job_or_404

router = APIRouter()


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, db: Session = Depends(get_db)) -> JobStatusResponse:
    return get_job_or_404(db, job_id)
