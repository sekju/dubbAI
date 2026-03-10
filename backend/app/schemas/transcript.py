from pydantic import BaseModel, ConfigDict


class TranscriptWord(BaseModel):
    text: str
    start_ms: int
    end_ms: int


class TranscriptChunk(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    speaker: str
    start_ms: int
    end_ms: int
    original_text: str
    translated_text: str
    words: list[TranscriptWord]
