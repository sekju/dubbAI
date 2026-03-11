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

    async def _generate_content(
        self,
        payload: dict,
        candidate_models: Iterable[str],
        *,
        timeout: float = 120.0,
    ) -> dict:
        last_error: httpx.HTTPStatusError | None = None

        async with httpx.AsyncClient(timeout=timeout) as client:
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

    def _parse_timestamp_ms(self, raw_value: object) -> int:
        if isinstance(raw_value, int):
            return raw_value

        if isinstance(raw_value, float):
            return int(raw_value)

        if not isinstance(raw_value, str):
            raise ValueError(f"Unsupported transcript timestamp payload: {raw_value!r}")

        parts = raw_value.split(":")
        if len(parts) not in {2, 3}:
            raise ValueError(f"Unsupported transcript timestamp payload: {raw_value!r}")

        seconds_part = parts[-1]
        if "." in seconds_part:
            seconds_text, millis_text = seconds_part.split(".", 1)
        else:
            seconds_text, millis_text = seconds_part, "0"

        try:
            seconds = int(seconds_text)
            minutes = int(parts[-2])
            hours = int(parts[0]) if len(parts) == 3 else 0
            millis = int((millis_text + "000")[:3])
        except ValueError as exc:
            raise ValueError(f"Unsupported transcript timestamp payload: {raw_value!r}") from exc

        return (((hours * 60) + minutes) * 60 + seconds) * 1000 + millis

    def _normalize_transcript_words(self, response_payload: object) -> dict[str, list[dict[str, object]]]:
        raw_words: object
        if isinstance(response_payload, list):
            raw_words = response_payload
        elif isinstance(response_payload, dict):
            if "words" not in response_payload:
                raise ValueError(f"Unsupported transcript payload: {response_payload!r}")
            raw_words = response_payload["words"]
        else:
            raise ValueError(f"Unsupported transcript payload: {response_payload!r}")

        if not isinstance(raw_words, list):
            raise ValueError(f"Unsupported transcript payload: {response_payload!r}")

        normalized_words: list[dict[str, object]] = []
        for position, item in enumerate(raw_words, start=1):
            if not isinstance(item, dict):
                raise ValueError(f"Unsupported transcript word payload: {item!r}")

            start = item.get("start")
            end = item.get("end")
            text = item.get("text")
            keyword = item.get("keyword")

            if (
                not isinstance(start, str | int | float)
                or not isinstance(end, str | int | float)
                or not isinstance(text, str)
                or not text.strip()
                or not isinstance(keyword, bool)
            ):
                raise ValueError(f"Unsupported transcript word payload: {item!r}")

            try:
                start_ms = self._parse_timestamp_ms(start)
                end_ms = self._parse_timestamp_ms(end)
            except ValueError as exc:
                raise ValueError(f"Unsupported transcript word payload: {item!r}") from exc

            normalized_words.append(
                {
                    "position": position,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "original_text": text,
                    "keyword": keyword,
                }
            )

        return {"words": normalized_words}

    async def transcribe_translate(self, audio_bytes: bytes, target_language: str = "pl") -> dict:
        if not self.settings.gemini_api_key:
            return {"words": []}

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        prompt = (
            "Return JSON only in a per-word subtitle format. Build a top-level 'words' array for subtitle rendering. "
            "Each word item must contain 'start', 'end', 'text', and 'keyword'. "
            "Use timestamp strings like '0:00.681'. Preserve punctuation inside word text. "
            "Mark important words or short key phrases with 'keyword': true. "
            "Do not return sentence-level segments or commentary. "
            f"Translation target is {target_language}, but this response must contain the original spoken words only."
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
            timeout=600.0,
        )

        candidate = data["candidates"][0]["content"]["parts"][0]["text"]
        response_payload = httpx.Response(200, text=candidate).json()
        return self._normalize_transcript_words(response_payload)

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
        translations_payload = response_payload.get("translations")
        if not isinstance(translations_payload, list):
            raise ValueError(f"Malformed translations payload: {translations_payload!r}")

        translations: list[str] = []
        for item in translations_payload:
            if isinstance(item, str):
                translations.append(item)
                continue

            if isinstance(item, dict) and isinstance(item.get("translated_text"), str):
                translations.append(item["translated_text"])
                continue

            raise ValueError(f"Unsupported translation item payload: {item!r}")

        return translations

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
