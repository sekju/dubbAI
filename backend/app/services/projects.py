from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.folder import Folder
from app.models.job import PipelineJob
from app.models.playlist import Playlist, PlaylistItem
from app.models.project import Project
from app.models.transcript import TranscriptSegment
from app.schemas.job import JobStatusResponse
from app.schemas.library import (
    FolderResponse,
    LibraryProjectResponse,
    LibraryResponse,
    PlaylistItemResponse,
    PlaylistResponse,
)
from app.schemas.project import ProjectResponse
from app.schemas.transcript import TranscriptChunk

INGEST_QUEUE = "app.tasks.ingest.ingest_source"
TRANSCRIBE_QUEUE = "app.tasks.ai.transcribe_project"
TRANSLATE_QUEUE = "app.tasks.ai.translate_project"
LANGUAGE_CODE_MAX_LENGTH = 32
ACTIVE_STAGE_STATUSES = {"queued", "in_progress"}
TRANSLATION_ONLY_LEGACY_STATUSES = {
    "translation_queued",
    "translating",
    "translated",
    "translation_failed",
}


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


def _should_include_translation(
    project: Project,
    segments: list[TranscriptSegment],
) -> bool:
    if project.translation_status == "not_started":
        return False
    return any(segment.translated_text for segment in segments)


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


def _clear_translated_segments(db: Session, project: Project) -> None:
    db.query(TranscriptSegment).filter(TranscriptSegment.project_id == project.id).update(
        {TranscriptSegment.translated_text: ""},
        synchronize_session=False,
    )


def _validate_pipeline_transition(project: Project, *, queue: str) -> None:
    if queue == TRANSCRIBE_QUEUE:
        if project.transcript_status in ACTIVE_STAGE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transcription is already queued or in progress",
            )
        if project.translation_status in ACTIVE_STAGE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot start transcription while translation is queued or in progress",
            )
        return

    if queue == TRANSLATE_QUEUE:
        if project.transcript_status != "ready":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot start translation before transcription is ready",
            )
        if project.translation_status in ACTIVE_STAGE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Translation is already queued or in progress",
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
        transcript_segments=_serialize_segments(
            segments,
            include_translation=_should_include_translation(project, segments),
        ),
    )


def serialize_library_project(project: Project) -> LibraryProjectResponse:
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
        folder_id=project.folder_id,
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
    status_value: str,
) -> JobStatusResponse:
    normalized_source_language = _normalize_language_code(source_language)
    normalized_target_language = _normalize_language_code(target_language)

    project = Project(
        id=str(uuid4()),
        owner_id="local-dev",
        name=name,
        source_type=source_type,
        source_url=source_url,
        source_language=normalized_source_language,
        target_language=_resolve_target_language(normalized_source_language, normalized_target_language),
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
        project.status = "transcription_queued"
        project.transcript_status = "queued"
        if project.translation_status != "not_started":
            project.translation_status = "not_started"
    if queue == TRANSLATE_QUEUE:
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
        projects=[serialize_library_project(project) for project in projects],
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
    return serialize_library_project(project)


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
