from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, UploadFile, status

from app.core.config import get_settings
from app.schemas.project import ProjectResponse

router = APIRouter(prefix="/media", tags=["media"])
settings = get_settings()


@router.post("/upload", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(file: UploadFile = File(...)) -> ProjectResponse:
    destination = settings.upload_directory / f"{uuid4()}-{file.filename}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    destination.write_bytes(content)

    return ProjectResponse(
        id=str(uuid4()),
        name=Path(file.filename).stem,
        source_type="upload",
        source_url=str(destination),
        status="uploaded",
    )
