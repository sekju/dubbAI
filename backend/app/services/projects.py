from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.models.folder import Folder
from app.models.job import PipelineJob
from app.models.playlist import Playlist, PlaylistItem
from app.models.project import Project
from app.models.transcript import TranscriptSegment, TranscriptWord
from app.schemas.job import JobStatusResponse
from app.schemas.library import (
    FolderResponse,
    LibraryProjectResponse,
    LibraryResponse,
    PlaylistItemResponse,
    PlaylistResponse,
)
from app.schemas.project import ProjectResponse
from app.schemas.transcript import TranscriptChunk, TranscriptWordPayload

INGEST_QUEUE = "app.tasks.ingest.ingest_source"
TRANSCRIBE_QUEUE = "app.tasks.ai.transcribe_project"
TRANSLATE_QUEUE = "app.tasks.ai.translate_project"
LANGUAGE_CODE_MAX_LENGTH = 32
ACTIVE_STAGE_STATUSES = {"queued", "in_progress"}
SUPPORTED_GEMINI_TEXT_MODELS = {"gemini-2.5-flash-lite", "gemini-2.5-flash"}
SUPPORTED_THINKING_MODES = {"off", "dynamic", "budget"}
TRANSLATION_ONLY_LEGACY_STATUSES = {
    "translation_queued",
    "translating",
    "translated",
    "translation_failed",
}

LEGACY_TRANSCRIPT_PLACEHOLDER_PREFIXES = (
    "transcript placeholder",
    "placeholder transcript",
)


def _resolve_target_language(source_language: str | None, target_language: str | None) -> str | None:
    if target_language is not None:
        return target_language
    if source_language == "en":
        return "pl"
    if source_language == "pl":
        return "en"
    return None


def _normalize_language_code(language: str | None) -> str | None:
    if language is None:
        return None

    normalized = language.strip().lower()
    if not normalized:
        return None
    if len(normalized) > LANGUAGE_CODE_MAX_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Language code must be at most {LANGUAGE_CODE_MAX_LENGTH} characters",
        )
    return normalized


def _normalize_gemini_model(model_name: str | None, *, default: str) -> str:
    normalized = (model_name or default).strip().lower()
    if normalized not in SUPPORTED_GEMINI_TEXT_MODELS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Unsupported Gemini text model",
        )
    return normalized


def _normalize_thinking_mode(mode: str | None, *, default: str) -> str:
    normalized = (mode or default).strip().lower()
    if normalized not in SUPPORTED_THINKING_MODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Unsupported Gemini thinking mode",
        )
    return normalized


def _normalize_max_output_tokens(value: int | None, *, default: int) -> int:
    resolved = value if value is not None else default
    if resolved < 1 or resolved > 65536:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Gemini max output tokens must be between 1 and 65536",
        )
    return resolved


def _normalize_thinking_budget(value: int | None, *, mode: str) -> int | None:
    if mode == "off":
        return None
    if mode == "dynamic":
        return -1

    resolved = value if value is not None else 1024
    if resolved < 0 or resolved > 24576:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Gemini thinking budget must be between 0 and 24576",
        )
    return resolved

def _serialize_segments(
    segments: list[TranscriptSegment],
    *,
    include_translation: bool,
) -> list[TranscriptChunk]:
    return [
        TranscriptChunk(
            speaker=segment.speaker,
            start_ms=segment.start_ms,
            end_ms=segment.end_ms,
            original_text=segment.original_text,
            translated_text=segment.translated_text if include_translation else "",
            words=[],
        )
        for segment in segments
    ]


def _serialize_words(words: list[TranscriptWord]) -> list[TranscriptWordPayload]:
    return [
        TranscriptWordPayload(
            position=word.position,
            start_ms=word.start_ms,
            end_ms=word.end_ms,
            original_text=word.original_text,
            translated_text=word.translated_text,
            keyword=word.keyword,
        )
        for word in words
    ]


def _load_transcript_words(db: Session, project: Project) -> list[TranscriptWord]:
    if not inspect(db.bind).has_table("transcript_words"):
        return []

    return db.scalars(
        select(TranscriptWord)
        .where(TranscriptWord.project_id == project.id)
        .order_by(TranscriptWord.position.asc())
    ).all()


def _should_include_translation(
    project: Project,
    segments: list[TranscriptSegment],
) -> bool:
    if project.translation_status == "not_started":
        return False
    return any(segment.translated_text for segment in segments)


def _is_legacy_transcript_placeholder(text: str) -> bool:
    normalized = text.strip().lower()
    return any(normalized.startswith(prefix) for prefix in LEGACY_TRANSCRIPT_PLACEHOLDER_PREFIXES)


def _looks_like_malformed_translation(text: str) -> bool:
    normalized = text.strip()
    if not normalized:
        return False
    return (
        (normalized.startswith("{") or normalized.startswith("["))
        and "translated_text" in normalized
    )


def _heal_stale_pipeline_state(
    db: Session,
    project: Project,
    segments: list[TranscriptSegment],
    words: list[TranscriptWord],
    *,
    active_job: JobStatusResponse | None,
) -> None:
    state_changed = False

    if active_job is None and (
        any(_is_legacy_transcript_placeholder(segment.original_text) for segment in segments)
        or (
            project.transcript_status == "ready"
            and not words
            and any(_is_legacy_transcript_placeholder(segment.original_text) for segment in segments)
        )
    ):
        project.status = "transcription_failed"
        project.transcript_status = "failed"
        state_changed = True

    if active_job is None and any(_looks_like_malformed_translation(word.translated_text) for word in words):
        project.status = "translation_failed"
        project.translation_status = "failed"
        state_changed = True

    if active_job is None and project.transcript_status in ACTIVE_STAGE_STATUSES:
        if project.status == "transcribed" or segments:
            project.transcript_status = "ready"
            state_changed = True
        elif project.status == "transcription_failed":
            project.transcript_status = "failed"
            state_changed = True

    if active_job is None and project.translation_status in ACTIVE_STAGE_STATUSES:
        if any(segment.translated_text for segment in segments):
            project.translation_status = "ready"
            state_changed = True

    if state_changed:
        db.add(project)
        db.commit()
        db.refresh(project)


def _legacy_compatible_status(project: Project) -> str:
    if project.status not in TRANSLATION_ONLY_LEGACY_STATUSES:
        return project.status
    if project.transcript_status == "queued":
        return "transcription_queued"
    if project.transcript_status == "in_progress":
        return "transcribing"
    if project.transcript_status == "ready":
        return "transcribed"
    if project.transcript_status == "failed":
        return "transcription_failed"
    return "queued"


def _get_active_job_for_project(db: Session, project: Project) -> JobStatusResponse | None:
    active_queues: list[str] = []

    if project.transcript_status in ACTIVE_STAGE_STATUSES:
        active_queues.append(TRANSCRIBE_QUEUE)
    if project.translation_status in ACTIVE_STAGE_STATUSES:
        active_queues.append(TRANSLATE_QUEUE)

    if not active_queues:
        return None

    active_job = db.scalars(
        select(PipelineJob)
        .where(PipelineJob.project_id == project.id)
        .where(PipelineJob.queue.in_(active_queues))
        .where(PipelineJob.state.in_(("queued", "started", "retry")))
    ).first()

    if active_job is None:
        return None

    return JobStatusResponse(
        job_id=active_job.id,
        project_id=active_job.project_id,
        state=active_job.state,
        progress=active_job.progress,
        queue=active_job.queue,
    )


def _derive_library_next_action(project: Project) -> str:
    if "failed" in {
        project.transcript_status,
        project.translation_status,
        project.dubbing_status,
    }:
        return "retry"

    if project.transcript_status == "not_started":
        return "transcribe"

    if project.transcript_status in ACTIVE_STAGE_STATUSES:
        return "open_theater"

    if project.translation_status == "not_started":
        return "translate"

    return "open_theater"


def _clear_translated_segments(db: Session, project: Project) -> None:
    db_engine = db.get_bind()
    inspector = inspect(db_engine)

    if inspector.has_table("transcript_segments"):
        db.query(TranscriptSegment).filter(TranscriptSegment.project_id == project.id).update(
            {TranscriptSegment.translated_text: ""},
            synchronize_session=False,
        )
    if inspector.has_table("transcript_words"):
        db.query(TranscriptWord).filter(TranscriptWord.project_id == project.id).update(
            {TranscriptWord.translated_text: ""},
            synchronize_session=False,
        )


def _clear_transcript_output(db: Session, project: Project) -> None:
    db_engine = db.get_bind()
    inspector = inspect(db_engine)

    if inspector.has_table("transcript_segments"):
        db.query(TranscriptSegment).filter(TranscriptSegment.project_id == project.id).delete(
            synchronize_session=False
        )
    if inspector.has_table("transcript_words"):
        db.query(TranscriptWord).filter(TranscriptWord.project_id == project.id).delete(
            synchronize_session=False
        )


def _validate_pipeline_transition(project: Project, *, queue: str) -> None:
    if queue == TRANSCRIBE_QUEUE:
        if project.transcript_status in ACTIVE_STAGE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transcription is already queued or in progress",
            )
        if project.translation_status != "not_started":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot start transcription after translation has started",
            )
        return

    if queue == TRANSLATE_QUEUE:
        if project.translation_status in {"queued", "in_progress", "ready"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Translation has already been started for this project",
            )
        if project.transcript_status != "ready":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot start translation before transcription is ready",
            )
        if project.transcript_status in ACTIVE_STAGE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot start translation while transcription is queued or in progress",
            )


def serialize_project(db: Session, project: Project) -> ProjectResponse:
    segments = db.scalars(
        select(TranscriptSegment)
        .where(TranscriptSegment.project_id == project.id)
        .order_by(TranscriptSegment.start_ms.asc())
    ).all()
    words = _load_transcript_words(db, project)
    active_job = _get_active_job_for_project(db, project)
    _heal_stale_pipeline_state(db, project, segments, words, active_job=active_job)
    active_job = _get_active_job_for_project(db, project)
    return ProjectResponse(
        id=project.id,
        name=project.name,
        source_type=project.source_type,
        source_url=project.source_url,
        source_language=project.source_language,
        target_language=project.target_language,
        status=_legacy_compatible_status(project),
        transcript_status=project.transcript_status,
        translation_status=project.translation_status,
        dubbing_status=project.dubbing_status,
        active_job=active_job,
        transcript_segments=_serialize_segments(
            segments,
            include_translation=_should_include_translation(project, segments),
        ),
        transcript_words=_serialize_words(words),
    )


def serialize_library_project(db: Session, project: Project) -> LibraryProjectResponse:
    segments = db.scalars(
        select(TranscriptSegment)
        .where(TranscriptSegment.project_id == project.id)
        .order_by(TranscriptSegment.start_ms.asc())
    ).all()
    words = _load_transcript_words(db, project)
    active_job = _get_active_job_for_project(db, project)
    _heal_stale_pipeline_state(db, project, segments, words, active_job=active_job)
    active_job = _get_active_job_for_project(db, project)
    return LibraryProjectResponse(
        id=project.id,
        name=project.name,
        status=_legacy_compatible_status(project),
        source_type=project.source_type,
        source_url=project.source_url,
        source_language=project.source_language,
        target_language=project.target_language,
        transcript_status=project.transcript_status,
        translation_status=project.translation_status,
        dubbing_status=project.dubbing_status,
        next_action=_derive_library_next_action(project),
        folder_id=project.folder_id,
        active_job=active_job,
    )


def serialize_folder(folder: Folder) -> FolderResponse:
    return FolderResponse(
        id=folder.id,
        name=folder.name,
        project_ids=[project.id for project in sorted(folder.projects, key=lambda project: project.name)],
    )


def serialize_playlist(playlist: Playlist) -> PlaylistResponse:
    return PlaylistResponse(
        id=playlist.id,
        name=playlist.name,
        items=[
            PlaylistItemResponse(project_id=item.project_id, position=item.position)
            for item in playlist.items
        ],
    )


def create_project_with_job(
    db: Session,
    *,
    name: str,
    source_type: str,
    source_url: str,
    source_language: str | None = None,
    target_language: str | None = None,
    gemini_model_text: str | None = None,
    gemini_thinking_mode: str | None = None,
    gemini_thinking_budget: int | None = None,
    gemini_max_output_tokens: int | None = None,
    gemini_structured_output: bool | None = None,
    status_value: str,
) -> JobStatusResponse:
    from app.core.config import get_settings

    settings = get_settings()
    normalized_source_language = _normalize_language_code(source_language)
    normalized_target_language = _normalize_language_code(target_language)
    normalized_model_name = _normalize_gemini_model(
        gemini_model_text,
        default=settings.gemini_model_text,
    )
    normalized_thinking_mode = _normalize_thinking_mode(
        gemini_thinking_mode,
        default=settings.gemini_thinking_mode,
    )
    normalized_max_output_tokens = _normalize_max_output_tokens(
        gemini_max_output_tokens,
        default=settings.gemini_max_output_tokens,
    )
    normalized_thinking_budget = _normalize_thinking_budget(
        gemini_thinking_budget,
        mode=normalized_thinking_mode,
    )

    project = Project(
        id=str(uuid4()),
        owner_id="local-dev",
        name=name,
        source_type=source_type,
        source_url=source_url,
        source_language=normalized_source_language,
        target_language=_resolve_target_language(normalized_source_language, normalized_target_language),
        gemini_model_text=normalized_model_name,
        gemini_thinking_mode=normalized_thinking_mode,
        gemini_thinking_budget=normalized_thinking_budget,
        gemini_max_output_tokens=normalized_max_output_tokens,
        gemini_structured_output=(
            settings.gemini_structured_output if gemini_structured_output is None else gemini_structured_output
        ),
        status=status_value,
    )
    job = PipelineJob(
        id=str(uuid4()),
        project_id=project.id,
        state="queued",
        progress=0,
        queue=INGEST_QUEUE,
    )
    db.add(project)
    db.flush()
    db.add(job)
    db.commit()
    return JobStatusResponse(
        job_id=job.id,
        project_id=project.id,
        state=job.state,
        progress=job.progress,
        queue=job.queue,
    )


def create_job_for_project(db: Session, *, project_id: str, queue: str) -> JobStatusResponse:
    project = get_project_model_or_404(db, project_id)
    _validate_pipeline_transition(project, queue=queue)

    if queue == TRANSCRIBE_QUEUE:
        if project.transcript_status == "failed":
            _clear_transcript_output(db, project)
        project.status = "transcription_queued"
        project.transcript_status = "queued"
    if queue == TRANSLATE_QUEUE:
        if project.translation_status == "failed":
            _clear_translated_segments(db, project)
        project.translation_status = "queued"

    job = PipelineJob(
        id=str(uuid4()),
        project_id=project.id,
        state="queued",
        progress=0,
        queue=queue,
    )
    db.add(project)
    db.add(job)
    db.commit()
    return JobStatusResponse(
        job_id=job.id,
        project_id=project.id,
        state=job.state,
        progress=job.progress,
        queue=job.queue,
    )


def list_projects(db: Session) -> list[ProjectResponse]:
    projects = db.scalars(select(Project).order_by(Project.name.asc())).all()
    return [serialize_project(db, project) for project in projects]


def get_library_data(db: Session) -> LibraryResponse:
    folders = db.scalars(select(Folder).order_by(Folder.name.asc())).all()
    playlists = db.scalars(select(Playlist).order_by(Playlist.name.asc())).all()
    projects = db.scalars(select(Project).order_by(Project.name.asc())).all()
    return LibraryResponse(
        folders=[serialize_folder(folder) for folder in folders],
        playlists=[serialize_playlist(playlist) for playlist in playlists],
        projects=[serialize_library_project(db, project) for project in projects],
    )


def get_project_or_404(db: Session, project_id: str) -> ProjectResponse:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return serialize_project(db, project)


def get_project_model_or_404(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def get_folder_model_or_404(db: Session, folder_id: str) -> Folder:
    folder = db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


def get_playlist_model_or_404(db: Session, playlist_id: str) -> Playlist:
    playlist = db.get(Playlist, playlist_id)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")
    return playlist


def create_folder(db: Session, *, name: str) -> FolderResponse:
    folder = Folder(id=str(uuid4()), owner_id="local-dev", name=name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return serialize_folder(folder)


def create_playlist(db: Session, *, name: str) -> PlaylistResponse:
    playlist = Playlist(id=str(uuid4()), owner_id="local-dev", name=name)
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return serialize_playlist(playlist)


def assign_project_to_folder(db: Session, *, project_id: str, folder_id: str) -> LibraryProjectResponse:
    project = get_project_model_or_404(db, project_id)
    get_folder_model_or_404(db, folder_id)
    project.folder_id = folder_id
    db.add(project)
    db.commit()
    db.refresh(project)
    return serialize_library_project(db, project)


def add_project_to_playlist(db: Session, *, playlist_id: str, project_id: str) -> PlaylistResponse:
    playlist = get_playlist_model_or_404(db, playlist_id)
    get_project_model_or_404(db, project_id)
    db.add(PlaylistItem(playlist_id=playlist_id, project_id=project_id, position=len(playlist.items) + 1))
    db.commit()
    db.refresh(playlist)
    return serialize_playlist(playlist)


def reorder_playlist_items(db: Session, *, playlist_id: str, project_ids: list[str]) -> PlaylistResponse:
    playlist = get_playlist_model_or_404(db, playlist_id)
    items_by_project = {item.project_id: item for item in playlist.items}

    for position, project_id in enumerate(project_ids, start=1):
        item = items_by_project.get(project_id)
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist item not found")
        item.position = position
        db.add(item)

    db.commit()
    db.refresh(playlist)
    return serialize_playlist(playlist)


def remove_project_from_playlist(db: Session, *, playlist_id: str, project_id: str) -> None:
    playlist = get_playlist_model_or_404(db, playlist_id)
    item_to_delete = next((item for item in playlist.items if item.project_id == project_id), None)
    if item_to_delete is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist item not found")

    db.delete(item_to_delete)
    db.flush()

    remaining_items = sorted(
        (item for item in playlist.items if item.project_id != project_id),
        key=lambda item: item.position,
    )
    for position, item in enumerate(remaining_items, start=1):
        item.position = position
        db.add(item)

    db.commit()


def delete_project(db: Session, *, project_id: str) -> None:
    project = get_project_model_or_404(db, project_id)

    for playlist_item in db.scalars(
        select(PlaylistItem).where(PlaylistItem.project_id == project_id)
    ).all():
        db.delete(playlist_item)

    for transcript_segment in db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.project_id == project_id)
    ).all():
        db.delete(transcript_segment)

    for job in db.scalars(select(PipelineJob).where(PipelineJob.project_id == project_id)).all():
        db.delete(job)

    db.delete(project)
    db.commit()


def get_job_or_404(db: Session, job_id: str) -> JobStatusResponse:
    job = db.get(PipelineJob, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobStatusResponse(
        job_id=job.id,
        project_id=job.project_id,
        state=job.state,
        progress=job.progress,
        queue=job.queue,
    )
