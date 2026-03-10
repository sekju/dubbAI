from app.core.config import Settings


def test_gemini_defaults_match_supported_model_families() -> None:
    settings = Settings(_env_file=None)

    assert settings.gemini_model_text == "gemini-2.5-flash-lite"
    assert settings.gemini_model_tts == "gemini-2.5-flash-preview-tts"
