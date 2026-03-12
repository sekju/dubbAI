from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), index=True, default="local-dev")
    name: Mapped[str] = mapped_column(String(120))
    items: Mapped[list["PlaylistItem"]] = relationship(
        back_populates="playlist",
        order_by="PlaylistItem.position",
        cascade="all, delete-orphan",
    )


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    playlist_id: Mapped[str] = mapped_column(ForeignKey("playlists.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)

    playlist: Mapped["Playlist"] = relationship(back_populates="items")
    project: Mapped["Project"] = relationship(back_populates="playlist_items")


from app.models.project import Project  # noqa: E402
