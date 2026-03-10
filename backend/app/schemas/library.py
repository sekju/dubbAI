from pydantic import BaseModel, Field


class FolderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class PlaylistCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class AssignProjectFolderRequest(BaseModel):
    folder_id: str


class AddPlaylistItemRequest(BaseModel):
    project_id: str


class ReorderPlaylistItemsRequest(BaseModel):
    project_ids: list[str] = Field(default_factory=list)


class LibraryProjectResponse(BaseModel):
    id: str
    name: str
    status: str
    source_type: str
    source_url: str | None = None
    folder_id: str | None = None


class FolderResponse(BaseModel):
    id: str
    name: str
    project_ids: list[str] = Field(default_factory=list)


class PlaylistItemResponse(BaseModel):
    project_id: str
    position: int


class PlaylistResponse(BaseModel):
    id: str
    name: str
    items: list[PlaylistItemResponse] = Field(default_factory=list)


class LibraryResponse(BaseModel):
    folders: list[FolderResponse] = Field(default_factory=list)
    playlists: list[PlaylistResponse] = Field(default_factory=list)
    projects: list[LibraryProjectResponse] = Field(default_factory=list)
