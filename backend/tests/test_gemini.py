import asyncio
import json

import httpx

from app.services.gemini import GeminiClient


def _response(status_code: int, model_name: str, payload: dict) -> httpx.Response:
    return httpx.Response(
        status_code,
        json=payload,
        request=httpx.Request(
            "POST",
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
        ),
    )


class FakeAsyncClient:
    def __init__(self, responses):
        self.responses = responses

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, params=None, json=None):
        model_name = url.split("/models/")[1].split(":")[0]
        response = self.responses[model_name]
        if response.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=httpx.Request("POST", url), response=response)
        return response


def test_transcribe_translate_retries_with_supported_fallback_model(monkeypatch) -> None:
    responses = {
        "gemini-3.1-flash-lite": _response(
            404, "gemini-3.1-flash-lite", {"error": {"message": "not found"}}
        ),
        "gemini-3.1-flash-lite-preview": _response(
            404, "gemini-3.1-flash-lite-preview", {"error": {"message": "not found"}}
        ),
        "gemini-2.5-flash-lite": _response(
            200,
            "gemini-2.5-flash-lite",
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "segments": [
                                                {
                                                    "speaker": "Speaker A",
                                                    "start_ms": 0,
                                                    "end_ms": 1000,
                                                    "original_text": "Hello",
                                                    "translated_text": "Czesc",
                                                    "words": [],
                                                }
                                            ]
                                        }
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        ),
    }
    monkeypatch.setattr("app.services.gemini.httpx.AsyncClient", lambda timeout: FakeAsyncClient(responses))

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-3.1-flash-lite"

    payload = asyncio.run(client.transcribe_translate(b"audio"))

    assert payload["segments"][0]["translated_text"] == "Czesc"


def test_translate_segments_returns_ordered_translations(monkeypatch) -> None:
    responses = {
        "gemini-3.1-flash-lite": _response(
            200,
            "gemini-3.1-flash-lite",
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps({"translations": ["Czesc", "Do widzenia"]})
                                }
                            ]
                        }
                    }
                ]
            },
        )
    }
    monkeypatch.setattr("app.services.gemini.httpx.AsyncClient", lambda timeout: FakeAsyncClient(responses))

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-3.1-flash-lite"

    translations = asyncio.run(
        client.translate_segments(
            [
                {"speaker": "Speaker A", "start_ms": 0, "end_ms": 1000, "original_text": "Hello"},
                {"speaker": "Speaker B", "start_ms": 1000, "end_ms": 2000, "original_text": "Bye"},
            ],
            target_language="pl",
        )
    )

    assert translations == ["Czesc", "Do widzenia"]
