from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), index=True, default="local-dev")
    name: Mapped[str] = mapped_column(String(120))
    source_type: Mapped[str] = mapped_column(String(32))
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    folder_id: Mapped[str | None] = mapped_column(ForeignKey("folders.id"), nullable=True, index=True)

    folder: Mapped["Folder | None"] = relationship(back_populates="projects")
    playlist_items: Mapped[list["PlaylistItem"]] = relationship(back_populates="project")


from app.models.folder import Folder  # noqa: E402
from app.models.playlist import PlaylistItem  # noqa: E402
