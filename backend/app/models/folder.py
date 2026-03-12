from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), index=True, default="local-dev")
    name: Mapped[str] = mapped_column(String(120))
    projects: Mapped[list["Project"]] = relationship(back_populates="folder")


from app.models.project import Project  # noqa: E402
