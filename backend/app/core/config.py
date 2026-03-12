from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "DubbAI API"
    environment: str = "development"
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3002"

    database_url: str = f"sqlite:///{(PROJECT_ROOT / 'storage' / 'dubbai.db').as_posix()}"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/0"

    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model_text: str = Field(default="gemini-2.5-flash-lite", alias="GEMINI_MODEL_TEXT")
    gemini_model_tts: str = Field(default="gemini-2.5-flash-preview-tts", alias="GEMINI_MODEL_TTS")
    gemini_max_output_tokens: int = Field(default=65536, alias="GEMINI_MAX_OUTPUT_TOKENS")
    gemini_thinking_mode: str = Field(default="off", alias="GEMINI_THINKING_MODE")
    gemini_thinking_budget: int = Field(default=0, alias="GEMINI_THINKING_BUDGET")
    gemini_structured_output: bool = Field(default=True, alias="GEMINI_STRUCTURED_OUTPUT")

    upload_directory: Path = Path("./storage/uploads")
    output_directory: Path = Path("./storage/outputs")
    max_video_size_mb: int = 500

    r2_endpoint_url: str = "https://example-account.r2.cloudflarestorage.com"
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "dubbai"
    r2_public_base_url: str = ""
    r2_region: str = "auto"

    jwt_secret_key: str = "change-me"
    jwt_refresh_secret_key: str = "change-me-too"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    smtp_host: str = "mailpit"
    smtp_port: int = 1025
    smtp_from_email: str = "noreply@dubbai.local"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.upload_directory.is_absolute():
        settings.upload_directory = (PROJECT_ROOT / settings.upload_directory).resolve()
    if not settings.output_directory.is_absolute():
        settings.output_directory = (PROJECT_ROOT / settings.output_directory).resolve()
    settings.upload_directory.mkdir(parents=True, exist_ok=True)
    settings.output_directory.mkdir(parents=True, exist_ok=True)
    return settings
