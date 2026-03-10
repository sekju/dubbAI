from typing import Literal

from pydantic import BaseModel, Field


class JobStatusResponse(BaseModel):
    job_id: str
    project_id: str
    state: Literal["queued", "started", "retry", "success", "failure"] = "queued"
    progress: int = Field(default=0, ge=0, le=100)
    queue: str


class ExportRequest(BaseModel):
    project_id: str
    subtitle_format: Literal["srt", "vtt", "ass", "mp4"] = "mp4"
    original_volume: int = Field(default=40, ge=0, le=100)
    dubbing_volume: int = Field(default=100, ge=0, le=100)
    burn_subtitles: bool = True
