from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    speaker: Mapped[str] = mapped_column(String(64))
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    original_text: Mapped[str] = mapped_column(Text)
    translated_text: Mapped[str] = mapped_column(Text)


class TranscriptWord(Base):
    __tablename__ = "transcript_words"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, index=True)
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    original_text: Mapped[str] = mapped_column(Text)
    translated_text: Mapped[str] = mapped_column(Text, default="")
    keyword: Mapped[bool] = mapped_column(Boolean, default=False)
