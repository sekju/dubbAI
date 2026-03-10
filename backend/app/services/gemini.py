from __future__ import annotations

import base64
import json
from collections.abc import Iterable

import httpx

from app.core.config import get_settings


class GeminiClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    def _candidate_models(self, configured_model: str, fallback_models: Iterable[str]) -> list[str]:
        candidates: list[str] = [configured_model]
        if configured_model == "gemini-3.1-flash-lite":
            candidates.append("gemini-3.1-flash-lite-preview")

        for fallback in fallback_models:
            if fallback not in candidates:
                candidates.append(fallback)

        return candidates

    async def _generate_content(self, payload: dict, candidate_models: Iterable[str]) -> dict:
        last_error: httpx.HTTPStatusError | None = None

        async with httpx.AsyncClient(timeout=120.0) as client:
            for model_name in candidate_models:
                try:
                    response = await client.post(
                        f"{self.base_url}/models/{model_name}:generateContent",
                        params={"key": self.settings.gemini_api_key},
                        json=payload,
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code != 404:
                        raise
                    last_error = exc

        if last_error:
            raise last_error

        raise RuntimeError("No Gemini model candidates configured")

    async def transcribe_translate(self, audio_bytes: bytes, target_language: str = "pl") -> dict:
        if not self.settings.gemini_api_key:
            return {"segments": []}

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        prompt = (
            "Return JSON with a top-level 'segments' array. Each segment must contain "
            "'speaker', 'start_ms', 'end_ms', 'original_text', 'translated_text', and 'words'. "
            f"Translate to {target_language}."
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "audio/wav", "data": audio_b64}},
                    ]
                }
            ],
            "generationConfig": {"responseMimeType": "application/json"},
        }
        data = await self._generate_content(
            payload,
            self._candidate_models(
                self.settings.gemini_model_text,
                ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
            ),
        )

        candidate = data["candidates"][0]["content"]["parts"][0]["text"]
        return httpx.Response(200, text=candidate).json()

    async def translate_segments(
        self,
        segments: list[dict[str, object]],
        target_language: str = "pl",
    ) -> list[str]:
        if not self.settings.gemini_api_key:
            return [str(segment["original_text"]) for segment in segments]

        prompt = (
            "Return JSON with a top-level 'translations' array. Preserve segment order exactly and return "
            f"one translated string per input segment. Translate to {target_language}."
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                f"{prompt}\n\n"
                                + json.dumps({"segments": segments}, ensure_ascii=True)
                            )
                        }
                    ]
                }
            ],
            "generationConfig": {"responseMimeType": "application/json"},
        }
        data = await self._generate_content(
            payload,
            self._candidate_models(
                self.settings.gemini_model_text,
                ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
            ),
        )

        candidate = data["candidates"][0]["content"]["parts"][0]["text"]
        response_payload = httpx.Response(200, text=candidate).json()
        return [str(item) for item in response_payload.get("translations", [])]

    async def synthesize_speech(self, text: str, voice_name: str) -> bytes:
        if not self.settings.gemini_api_key:
            return b""

        payload = {
            "contents": [{"parts": [{"text": text}]}],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice_name}}},
        }
        data = await self._generate_content(
            payload,
            self._candidate_models(
                self.settings.gemini_model_tts,
                ["gemini-2.5-flash-preview-tts"],
            ),
        )

        audio_data = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
        return base64.b64decode(audio_data)
