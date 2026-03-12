from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.folder import Folder
from app.models.playlist import Playlist, PlaylistItem
from app.models.project import Project


def test_project_can_belong_to_one_folder() -> None:
    with SessionLocal() as db:
        folder = Folder(id="folder-1", owner_id="local-dev", name="Favorites")
        project = Project(
            id="project-1",
            owner_id="local-dev",
            name="Demo clip",
            source_type="upload",
            source_url="/storage/uploads/demo.mp4",
            status="ready",
            folder=folder,
        )

        db.add_all([folder, project])
        db.commit()
        db.expire_all()

        saved_project = db.get(Project, "project-1")
        assert saved_project is not None
        assert saved_project.folder_id == "folder-1"
        assert saved_project.folder is not None
        assert saved_project.folder.name == "Favorites"


def test_playlist_stores_ordered_items_and_allows_shared_projects() -> None:
    with SessionLocal() as db:
        playlist_a = Playlist(id="playlist-a", owner_id="local-dev", name="Practice set")
        playlist_b = Playlist(id="playlist-b", owner_id="local-dev", name="Review set")
        project_1 = Project(
            id="project-1",
            owner_id="local-dev",
            name="Scene one",
            source_type="upload",
            source_url="/storage/uploads/scene-1.mp4",
            status="ready",
        )
        project_2 = Project(
            id="project-2",
            owner_id="local-dev",
            name="Scene two",
            source_type="upload",
            source_url="/storage/uploads/scene-2.mp4",
            status="ready",
        )

        db.add_all(
            [
                playlist_a,
                playlist_b,
                project_1,
                project_2,
                PlaylistItem(playlist=playlist_a, project=project_2, position=1),
                PlaylistItem(playlist=playlist_a, project=project_1, position=2),
                PlaylistItem(playlist=playlist_b, project=project_1, position=1),
            ]
        )
        db.commit()
        db.expire_all()

        saved_playlist = db.scalars(select(Playlist).where(Playlist.id == "playlist-a")).one()
        assert [item.project_id for item in saved_playlist.items] == ["project-2", "project-1"]

        shared_project = db.get(Project, "project-1")
        assert shared_project is not None
        assert sorted(item.playlist_id for item in shared_project.playlist_items) == [
            "playlist-a",
            "playlist-b",
        ]
