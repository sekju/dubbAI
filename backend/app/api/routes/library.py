from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.library import (
    AddPlaylistItemRequest,
    AssignProjectFolderRequest,
    FolderCreateRequest,
    FolderResponse,
    LibraryProjectResponse,
    LibraryResponse,
    PlaylistCreateRequest,
    PlaylistResponse,
    ReorderPlaylistItemsRequest,
)
from app.services.projects import (
    add_project_to_playlist,
    assign_project_to_folder,
    create_folder,
    create_playlist,
    get_library_data,
    remove_project_from_playlist,
    reorder_playlist_items,
)

router = APIRouter()


@router.get("", response_model=LibraryResponse)
async def get_library(db: Session = Depends(get_db)) -> LibraryResponse:
    return get_library_data(db)


@router.post("/folders", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def post_folder(
    payload: FolderCreateRequest,
    db: Session = Depends(get_db),
) -> FolderResponse:
    return create_folder(db, name=payload.name)


@router.post("/playlists", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
async def post_playlist(
    payload: PlaylistCreateRequest,
    db: Session = Depends(get_db),
) -> PlaylistResponse:
    return create_playlist(db, name=payload.name)


@router.post("/projects/{project_id}/folder", response_model=LibraryProjectResponse)
async def post_project_folder(
    project_id: str,
    payload: AssignProjectFolderRequest,
    db: Session = Depends(get_db),
) -> LibraryProjectResponse:
    return assign_project_to_folder(db, project_id=project_id, folder_id=payload.folder_id)


@router.post("/playlists/{playlist_id}/items", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
async def post_playlist_item(
    playlist_id: str,
    payload: AddPlaylistItemRequest,
    db: Session = Depends(get_db),
) -> PlaylistResponse:
    return add_project_to_playlist(db, playlist_id=playlist_id, project_id=payload.project_id)


@router.patch("/playlists/{playlist_id}/items/reorder", response_model=PlaylistResponse)
async def patch_playlist_reorder(
    playlist_id: str,
    payload: ReorderPlaylistItemsRequest,
    db: Session = Depends(get_db),
) -> PlaylistResponse:
    return reorder_playlist_items(db, playlist_id=playlist_id, project_ids=payload.project_ids)


@router.delete("/playlists/{playlist_id}/items/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist_item(
    playlist_id: str,
    project_id: str,
    db: Session = Depends(get_db),
) -> Response:
    remove_project_from_playlist(db, playlist_id=playlist_id, project_id=project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
