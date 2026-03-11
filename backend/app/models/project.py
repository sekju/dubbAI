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
    source_language: Mapped[str | None] = mapped_column(String(32), nullable=True, default=None)
    target_language: Mapped[str | None] = mapped_column(String(32), nullable=True, default=None)
    gemini_model_text: Mapped[str] = mapped_column(String(64), default="gemini-2.5-flash-lite")
    gemini_thinking_mode: Mapped[str] = mapped_column(String(16), default="off")
    gemini_thinking_budget: Mapped[int | None] = mapped_column(nullable=True, default=None)
    gemini_max_output_tokens: Mapped[int] = mapped_column(default=65536)
    gemini_structured_output: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    transcript_status: Mapped[str] = mapped_column(String(32), default="not_started")
    translation_status: Mapped[str] = mapped_column(String(32), default="not_started")
    dubbing_status: Mapped[str] = mapped_column(String(32), default="not_started")
    folder_id: Mapped[str | None] = mapped_column(ForeignKey("folders.id"), nullable=True, index=True)

    folder: Mapped["Folder | None"] = relationship(back_populates="projects")
    playlist_items: Mapped[list["PlaylistItem"]] = relationship(back_populates="project")


from app.models.folder import Folder  # noqa: E402
from app.models.playlist import PlaylistItem  # noqa: E402
