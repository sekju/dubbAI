from app.schemas.transcript import TranscriptChunk, TranscriptWord


PIPELINE_TASKS = [
    "app.tasks.ingest.ingest_source",
    "app.tasks.ai.transcribe_and_translate",
    "app.tasks.ai.generate_dubbing",
    "app.tasks.render.render_project",
]


def parse_transcript_payload(payload: dict) -> list[TranscriptChunk]:
    chunks: list[TranscriptChunk] = []
    for segment in payload.get("segments", []):
        words = []
        for word in segment.get("words", []):
            if "text" not in word and "word" in word:
                word = {**word, "text": word["word"]}
            words.append(TranscriptWord.model_validate(word))

        chunks.append(
            TranscriptChunk(
                speaker=segment["speaker"],
                start_ms=segment["start_ms"],
                end_ms=segment["end_ms"],
                original_text=segment["original_text"],
                translated_text=segment["translated_text"],
                words=words,
            )
        )
    return chunks


def build_pipeline_signature(project_id: str, source_type: str) -> dict[str, object]:
    return {
        "project_id": project_id,
        "source_type": source_type,
        "tasks": PIPELINE_TASKS,
    }
