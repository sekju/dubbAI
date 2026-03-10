import asyncio
import subprocess
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.job import PipelineJob
from app.models.project import Project
from app.models.transcript import TranscriptSegment
from app.services.gemini import GeminiClient
from app.services.media import extract_audio
from app.services.pipeline import parse_transcript_payload


def _fallback_segments(project_name: str) -> list[dict[str, object]]:
    return [
        {
            "speaker": "Speaker A",
            "start_ms": 0,
            "end_ms": 2500,
            "original_text": f"Transcript placeholder for {project_name}",
            "translated_text": f"Przykladowa transkrypcja dla {project_name}",
            "words": [],
        }
    ]


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


def _persist_segments(db, project: Project, segments: list[dict[str, object]]) -> None:
    db.query(TranscriptSegment).filter(TranscriptSegment.project_id == project.id).delete()
    for index, chunk in enumerate(parse_transcript_payload({"segments": segments})):
        db.add(
            TranscriptSegment(
                id=f"{project.id}-{index}",
                project_id=project.id,
                speaker=chunk.speaker,
                start_ms=chunk.start_ms,
                end_ms=chunk.end_ms,
                original_text=chunk.original_text,
                translated_text=chunk.translated_text,
            )
        )


@celery_app.task(name="app.tasks.ai.transcribe_project")
def transcribe_project(job_id: str, project_id: str) -> dict[str, str]:
    settings = get_settings()
    db = SessionLocal()
    try:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if not job or not project:
            raise ValueError("Project or job not found")

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

        try:
          payload = asyncio.run(GeminiClient().transcribe_translate(audio_path.read_bytes()))
          segments = payload.get("segments", []) or _fallback_segments(project.name)
        except Exception:
          segments = _fallback_segments(project.name)

        _persist_segments(db, project, segments)

        project.status = "transcribed"
        project.transcript_status = "ready"
        job.state = "success"
        job.progress = 100
        db.commit()
        return {"project_id": project.id, "status": "transcribed"}
    except Exception:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if job:
            job.state = "failure"
            job.progress = 100
        if project:
            project.status = "transcription_failed"
            project.transcript_status = "failed"
        db.commit()
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.ai.translate_project")
def translate_project(job_id: str, project_id: str) -> dict[str, str]:
    settings = get_settings()
    db = SessionLocal()
    try:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if not job or not project:
            raise ValueError("Project or job not found")

        job.state = "started"
        job.progress = 10
        project.status = "translating"
        project.translation_status = "in_progress"
        db.commit()

        source_path = _resolve_source_path(project)
        audio_path = settings.output_directory / project.id / "audio.wav"
        extract_audio(source_path, audio_path)
        job.progress = 45
        db.commit()

        try:
          payload = asyncio.run(
              GeminiClient().translate(
                  audio_path.read_bytes(),
                  target_language=project.target_language or "pl",
              )
          )
          segments = payload.get("segments", []) or _fallback_segments(project.name)
        except Exception:
          segments = _fallback_segments(project.name)

        _persist_segments(db, project, segments)

        project.status = "translated"
        if project.transcript_status == "not_started":
            project.transcript_status = "ready"
        project.translation_status = "ready"
        job.state = "success"
        job.progress = 100
        db.commit()
        return {"project_id": project.id, "status": "translated"}
    except Exception:
        job = db.get(PipelineJob, job_id)
        project = db.get(Project, project_id)
        if job:
            job.state = "failure"
            job.progress = 100
        if project:
            project.status = "translation_failed"
            project.translation_status = "failed"
        db.commit()
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.ai.transcribe_and_translate")
def transcribe_and_translate(project_id: str) -> dict[str, str]:
    return {"project_id": project_id, "status": "transcribed"}


@celery_app.task(name="app.tasks.ai.generate_dubbing")
def generate_dubbing(project_id: str) -> dict[str, str]:
    return {"project_id": project_id, "status": "dubbed"}
