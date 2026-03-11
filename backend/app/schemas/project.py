from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.job import JobStatusResponse
from app.schemas.transcript import TranscriptChunk, TranscriptWordPayload


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    source_type: Literal["upload", "url"] = "upload"
    source_url: str | None = None
    source_language: str | None = None
    target_language: str | None = None
    gemini_model_text: Literal["gemini-2.5-flash-lite", "gemini-2.5-flash"] | None = None
    gemini_thinking_mode: Literal["off", "dynamic", "budget"] | None = None
    gemini_thinking_budget: int | None = None
    gemini_max_output_tokens: int | None = None
    gemini_structured_output: bool | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    source_type: Literal["upload", "url"]
    source_url: str | None = None
    source_language: str | None = None
    target_language: str | None = None
    status: str
    transcript_status: str = "not_started"
    translation_status: str = "not_started"
    dubbing_status: str = "not_started"
    active_job: JobStatusResponse | None = None
    transcript_segments: list[TranscriptChunk] = Field(default_factory=list)
    transcript_words: list[TranscriptWordPayload] = Field(default_factory=list)


class ProjectImportRequest(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    source_url: str = Field(min_length=8)
    source_language: str | None = None
    target_language: str | None = None
    gemini_model_text: Literal["gemini-2.5-flash-lite", "gemini-2.5-flash"] | None = None
    gemini_thinking_mode: Literal["off", "dynamic", "budget"] | None = None
    gemini_thinking_budget: int | None = None
    gemini_max_output_tokens: int | None = None
    gemini_structured_output: bool | None = None
