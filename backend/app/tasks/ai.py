import asyncio
import subprocess
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.job import PipelineJob
from app.models.project import Project
from app.models.transcript import TranscriptSegment, TranscriptWord
from app.services.gemini import GeminiClient
from app.services.media import extract_audio

ACTIVE_STAGE_STATUSES = {"queued", "in_progress"}
SEGMENT_BREAK_CHARS = {".", "!", "?", ":", ";"}
SEGMENT_BREAK_GAP_MS = 1200
SEGMENT_MAX_WORDS = 12


class StageConflictError(RuntimeError):
    pass


def _resolve_source_path(project: Project) -> Path:
    settings = get_settings()
    if not project.source_url:
        raise FileNotFoundError("Project source URL is missing")

    if project.source_url.startswith("/storage/"):
        return settings.upload_directory.parent / project.source_url.removeprefix("/storage/")

    if project.source_url.startswith("http://") or project.source_url.startswith("https://"):
        target_dir = settings.upload_directory / project.id
        target_dir.mkdir(parents=True, exist_ok=True)
        output_template = target_dir / "source.%(ext)s"
        subprocess.run(
            ["yt-dlp", "-o", str(output_template), project.source_url],
            check=True,
            capture_output=True,
            text=True,
        )
        candidates = sorted(target_dir.glob("source.*"))
        if not candidates:
            raise FileNotFoundError("yt-dlp did not create a source file")
        source_path = candidates[0]
        project.source_url = f"/storage/uploads/{project.id}/{source_path.name}"
        return source_path

    return Path(project.source_url)


def _validate_word_payload(word: dict[str, object]) -> None:
    if not isinstance(word.get("position"), int):
        raise ValueError(f"Unsupported transcript word payload: {word!r}")
    if not isinstance(word.get("start_ms"), int):
        raise ValueError(f"Unsupported transcript word payload: {word!r}")
    if not isinstance(word.get("end_ms"), int):
        raise ValueError(f"Unsupported transcript word payload: {word!r}")
    if word["end_ms"] < word["start_ms"]:
        raise ValueError(f"Unsupported transcript word payload: {word!r}")
    if not isinstance(word.get("original_text"), str) or not word["original_text"].strip():
        raise ValueError(f"Unsupported transcript word payload: {word!r}")
    if not isinstance(word.get("keyword"), bool):
        raise ValueError(f"Unsupported transcript word payload: {word!r}")
    translated_text = word.get("translated_text", "")
    if not isinstance(translated_text, str):
        raise ValueError(f"Unsupported transcript word payload: {word!r}")


def _persist_segments(
    db,
    project: Project,
    segments: list[dict[str, object]],
    *,
    include_translation: bool,
) -> None:
    db.query(TranscriptSegment).filter(TranscriptSegment.project_id == project.id).delete()
    for index, segment in enumerate(segments, start=1):
        speaker = segment.get("speaker")
        start_ms = segment.get("start_ms")
        end_ms = segment.get("end_ms")
        original_text = segment.get("original_text")
        translated_text = segment.get("translated_text", "")

        if not isinstance(speaker, str):
            raise ValueError(f"Unsupported transcript segment payload: {segment!r}")
        if not isinstance(start_ms, int) or not isinstance(end_ms, int):
            raise ValueError(f"Unsupported transcript segment payload: {segment!r}")
        if end_ms < start_ms:
            raise ValueError(f"Unsupported transcript segment payload: {segment!r}")
        if not isinstance(original_text, str) or not original_text.strip():
            raise ValueError(f"Unsupported transcript segment payload: {segment!r}")
        if not isinstance(translated_text, str):
            raise ValueError(f"Unsupported transcript segment payload: {segment!r}")

        db.add(
            TranscriptSegment(
                id=f"{project.id}-segment-{index}",
                project_id=project.id,
                speaker=speaker,
                start_ms=start_ms,
                end_ms=end_ms,
                original_text=original_text,
                translated_text=translated_text if include_translation else "",
            )
        )


def _build_segments_from_words(words: list[dict[str, object]]) -> list[dict[str, object]]:
    if not words:
        return []

    segments: list[dict[str, object]] = []
    current_words: list[dict[str, object]] = []

    def flush_current_words() -> None:
        if not current_words:
            return

        translated_parts = [
            str(word.get("translated_text", "")).strip()
            for word in current_words
            if str(word.get("translated_text", "")).strip()
        ]
        segments.append(
            {
                "speaker": "Speaker A",
                "start_ms": int(current_words[0]["start_ms"]),
                "end_ms": int(current_words[-1]["end_ms"]),
                "original_text": " ".join(str(word["original_text"]) for word in current_words),
                "translated_text": " ".join(translated_parts),
                "word_count": len(current_words),
            }
        )
        current_words.clear()

    previous_end_ms: int | None = None
    for word in words:
        current_words.append(word)
        text = str(word["original_text"]).strip()
        start_ms = int(word["start_ms"])
        gap_ms = start_ms - previous_end_ms if previous_end_ms is not None else 0
        previous_end_ms = int(word["end_ms"])

        if (
            len(current_words) >= SEGMENT_MAX_WORDS
            or gap_ms >= SEGMENT_BREAK_GAP_MS
            or (text and text[-1] in SEGMENT_BREAK_CHARS)
        ):
            flush_current_words()

    flush_current_words()
    return segments


def _persist_transcript_words(db, project: Project, words: list[dict[str, object]]) -> None:
    db.query(TranscriptWord).filter(TranscriptWord.project_id == project.id).delete()
    for word in words:
        _validate_word_payload(word)
        db.add(
            TranscriptWord(
                id=f"{project.id}-word-{word['position']}",
                project_id=project.id,
                position=word["position"],
                start_ms=word["start_ms"],
                end_ms=word["end_ms"],
                original_text=word["original_text"],
                translated_text=str(word.get("translated_text", "")),
                keyword=word["keyword"],
            )
        )


def _ordered_words(db, project: Project) -> list[TranscriptWord]:
    return (
        db.query(TranscriptWord)
        .filter(TranscriptWord.project_id == project.id)
        .order_by(TranscriptWord.position.asc(), TranscriptWord.id.asc())
        .all()
    )


def _clear_transcript_output(db, project: Project) -> None:
    db.query(TranscriptWord).filter(TranscriptWord.project_id == project.id).delete()
    db.query(TranscriptSegment).filter(TranscriptSegment.project_id == project.id).delete()


def _clear_translated_segments(db, project: Project) -> None:
    db.query(TranscriptSegment).filter(TranscriptSegment.project_id == project.id).update(
        {TranscriptSegment.translated_text: ""},
        synchronize_session=False,
    )
    db.query(TranscriptWord).filter(TranscriptWord.project_id == project.id).update(
        {TranscriptWord.translated_text: ""},
        synchronize_session=False,
    )


def _ensure_transcription_job_can_start(project: Project) -> None:
    if project.transcript_status != "queued":
        raise StageConflictError("Transcription job is stale")
    if project.translation_status != "not_started":
        raise StageConflictError("Cannot start transcription after translation has started")


def _ensure_translation_job_can_start(project: Project) -> None:
    if project.translation_status != "queued":
        raise StageConflictError("Translation job is stale")
    if project.transcript_status != "ready":
        raise StageConflictError("Cannot start translation before transcription is ready")
    if project.transcript_status in ACTIVE_STAGE_STATUSES:
        raise StageConflictError("Cannot start translation while transcription is queued or in progress")


def _word_models_to_payload(words: list[TranscriptWord]) -> list[dict[str, object]]:
    return [
        {
            "position": word.position,
            "start_ms": word.start_ms,
            "end_ms": word.end_ms,
            "original_text": word.original_text,
            "translated_text": word.translated_text,
            "keyword": word.keyword,
        }
        for word in words
    ]


def _assign_segment_translations_to_words(
    word_payloads: list[dict[str, object]],
    segments: list[dict[str, object]],
    translated_texts: list[str],
) -> list[dict[str, object]]:
    if len(segments) != len(translated_texts):
        raise ValueError(
            "Gemini translation response length mismatch: "
            f"{len(translated_texts)} translations for {len(segments)} segments"
        )

    next_word_index = 0
    for segment, translated_text in zip(segments, translated_texts, strict=True):
        word_count = int(segment.get("word_count", 0))
        segment_words = word_payloads[next_word_index:next_word_index + word_count]
        next_word_index += word_count

        tokens = translated_text.split()
        if not segment_words:
            continue

        if not tokens:
            for word in segment_words:
                word["translated_text"] = ""
            continue

        if len(segment_words) == 1:
            segment_words[0]["translated_text"] = translated_text
            segment["translated_text"] = translated_text
            continue

        total_tokens = len(tokens)
        for index, word in enumerate(segment_words):
            start = round(index * total_tokens / len(segment_words))
            end = round((index + 1) * total_tokens / len(segment_words))
            if end <= start:
                end = min(total_tokens, start + 1)
            word["translated_text"] = " ".join(tokens[start:end]).strip()

        segment["translated_text"] = translated_text

    return word_payloads


@celery_app.task(name="app.tasks.ai.transcribe_project")
def transcribe_project(job_id: str, project_id: str) -> dict[str, str]:
    settings = get_settings()
    db = SessionLocal()
    try:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if not job or not project:
            raise ValueError("Project or job not found")

        _ensure_transcription_job_can_start(project)

        job.state = "started"
        job.progress = 10
        project.status = "transcribing"
        project.transcript_status = "in_progress"
        db.commit()

        source_path = _resolve_source_path(project)
        audio_path = settings.output_directory / project.id / "audio.wav"
        extract_audio(source_path, audio_path)
        job.progress = 45
        db.commit()

        payload = asyncio.run(
            GeminiClient().transcribe_translate(
                audio_path.read_bytes(),
                target_language=project.target_language or "pl",
                source_language=project.source_language,
                model_name=project.gemini_model_text,
                thinking_mode=project.gemini_thinking_mode,
                thinking_budget=project.gemini_thinking_budget,
                max_output_tokens=project.gemini_max_output_tokens,
                structured_output=project.gemini_structured_output,
            )
        )
        words = payload.get("words", [])
        if not words:
            raise RuntimeError("Gemini returned no transcript words")

        _clear_transcript_output(db, project)
        _persist_transcript_words(db, project, words)
        _persist_segments(db, project, _build_segments_from_words(words), include_translation=False)

        project.status = "transcribed"
        project.transcript_status = "ready"
        job.state = "success"
        job.progress = 100
        db.commit()
        return {"project_id": project.id, "status": "transcribed"}
    except StageConflictError:
        job = db.get(PipelineJob, job_id)
        if job:
            job.state = "failure"
            job.progress = 100
        db.commit()
        raise
    except Exception:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if job:
            job.state = "failure"
            job.progress = 100
        if project:
            _clear_transcript_output(db, project)
            project.status = "transcription_failed"
            project.transcript_status = "failed"
        db.commit()
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.ai.translate_project")
def translate_project(job_id: str, project_id: str) -> dict[str, str]:
    db = SessionLocal()
    try:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if not job or not project:
            raise ValueError("Project or job not found")

        _ensure_translation_job_can_start(project)
        words = _ordered_words(db, project)
        if not words:
            raise StageConflictError("Cannot start translation before transcription words exist")

        job.state = "started"
        job.progress = 10
        project.translation_status = "in_progress"
        _clear_translated_segments(db, project)
        db.commit()

        job.progress = 45
        db.commit()

        word_payloads = _word_models_to_payload(words)
        segment_payloads = _build_segments_from_words(word_payloads)

        translated_texts = asyncio.run(
            GeminiClient().translate_segments(
                [
                    {
                        "start_ms": segment["start_ms"],
                        "end_ms": segment["end_ms"],
                        "original_text": segment["original_text"],
                    }
                    for segment in segment_payloads
                ],
                target_language=project.target_language or "pl",
                model_name=project.gemini_model_text,
                thinking_mode=project.gemini_thinking_mode,
                thinking_budget=project.gemini_thinking_budget,
                max_output_tokens=project.gemini_max_output_tokens,
                structured_output=project.gemini_structured_output,
            )
        )

        translated_word_payloads = _assign_segment_translations_to_words(
            word_payloads,
            segment_payloads,
            translated_texts,
        )

        for word, translated_payload in zip(words, translated_word_payloads, strict=True):
            word.translated_text = str(translated_payload.get("translated_text", ""))
            db.add(word)

        _persist_segments(
            db,
            project,
            segment_payloads,
            include_translation=True,
        )

        project.status = "translated"
        project.translation_status = "ready"
        job.state = "success"
        job.progress = 100
        db.commit()
        return {"project_id": project.id, "status": project.status}
    except StageConflictError:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if job:
            job.state = "failure"
            job.progress = 100
        if project:
            _clear_translated_segments(db, project)
            project.translation_status = "not_started"
        db.commit()
        raise
    except Exception:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if job:
            job.state = "failure"
            job.progress = 100
        if project:
            _clear_translated_segments(db, project)
            project.status = "translation_failed"
            project.translation_status = "failed"
        db.commit()
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.ai.generate_dubbing")
def generate_dubbing(project_id: str) -> dict[str, str]:
    return {"project_id": project_id, "status": "dubbed"}
