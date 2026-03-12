import asyncio
import json

import httpx
import pytest

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


class CapturingAsyncClient(FakeAsyncClient):
    captured_timeout = None

    def __init__(self, responses, timeout=None):
        super().__init__(responses)
        self.__class__.captured_timeout = timeout


class RecordingAsyncClient(FakeAsyncClient):
    captured_payload = None

    async def post(self, url, params=None, json=None):
        self.__class__.captured_payload = json
        return await super().post(url, params=params, json=json)


class SequentialAsyncClient:
    def __init__(self, responses):
        self.responses = responses

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, params=None, json=None):
        response = self.responses.pop(0)
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
                                            "words": [
                                                {
                                                    "start": "0:00.681",
                                                    "end": "0:01.321",
                                                    "text": "custom",
                                                    "keyword": True,
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

    assert payload["words"] == [
        {
            "position": 1,
            "start_ms": 681,
            "end_ms": 1321,
            "original_text": "custom",
            "keyword": True,
        }
    ]


def test_transcribe_translate_requests_per_word_json_format(monkeypatch) -> None:
    responses = {
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
                                            "words": [
                                                {
                                                    "start": "0:00.000",
                                                    "end": "0:00.500",
                                                    "text": "Hello,",
                                                    "keyword": False,
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
        )
    }
    monkeypatch.setattr(
        "app.services.gemini.httpx.AsyncClient",
        lambda timeout: RecordingAsyncClient(responses),
    )

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    asyncio.run(client.transcribe_translate(b"audio", target_language="pl"))

    prompt = RecordingAsyncClient.captured_payload["contents"][0]["parts"][0]["text"]
    assert "per-word" in prompt.lower()
    assert "'start'" in prompt
    assert "'end'" in prompt
    assert "'text'" in prompt
    assert "'keyword'" in prompt


def test_transcribe_translate_accepts_top_level_word_array(monkeypatch) -> None:
    responses = {
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
                                        [
                                            {
                                                "start": "0:00.000",
                                                "end": "0:00.240",
                                                "text": "Hello,",
                                                "keyword": False,
                                            }
                                        ]
                                    )
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
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    payload = asyncio.run(client.transcribe_translate(b"audio"))

    assert payload["words"] == [
        {
            "position": 1,
            "start_ms": 0,
            "end_ms": 240,
            "original_text": "Hello,",
            "keyword": False,
        }
    ]


def test_transcribe_translate_defaults_missing_keyword_to_false(monkeypatch) -> None:
    responses = {
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
                                            "words": [
                                                {
                                                    "start": "0:00.000",
                                                    "end": "0:00.240",
                                                    "text": "Hello,"
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
        )
    }
    monkeypatch.setattr("app.services.gemini.httpx.AsyncClient", lambda timeout: FakeAsyncClient(responses))

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    payload = asyncio.run(client.transcribe_translate(b"audio"))

    assert payload["words"] == [
        {
            "position": 1,
            "start_ms": 0,
            "end_ms": 240,
            "original_text": "Hello,",
            "keyword": False,
        }
    ]


def test_transcribe_translate_retries_once_after_malformed_json(monkeypatch) -> None:
    responses = [
        _response(
            200,
            "gemini-2.5-flash-lite",
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": '{"words":[{"start":"0:00.000"'}]
                        }
                    }
                ]
            },
        ),
        _response(
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
                                            "words": [
                                                {
                                                    "start": "0:00.000",
                                                    "end": "0:00.240",
                                                    "text": "Hello,",
                                                    "keyword": False,
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
    ]
    monkeypatch.setattr(
        "app.services.gemini.httpx.AsyncClient",
        lambda timeout: SequentialAsyncClient(responses),
    )

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    payload = asyncio.run(client.transcribe_translate(b"audio"))

    assert payload["words"][0]["original_text"] == "Hello,"


def test_transcribe_translate_retries_once_after_empty_words(monkeypatch) -> None:
    responses = [
        _response(
            200,
            "gemini-2.5-flash-lite",
            {"candidates": [{"content": {"parts": [{"text": json.dumps({"words": []})}]}}]},
        ),
        _response(
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
                                            "words": [
                                                {
                                                    "start": "0:00.000",
                                                    "end": "0:00.240",
                                                    "text": "Hello,",
                                                    "keyword": False,
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
    ]
    monkeypatch.setattr(
        "app.services.gemini.httpx.AsyncClient",
        lambda timeout: SequentialAsyncClient(responses),
    )

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    payload = asyncio.run(client.transcribe_translate(b"audio"))

    assert payload["words"][0]["original_text"] == "Hello,"


def test_transcribe_translate_rejects_malformed_word_payload(monkeypatch) -> None:
    responses = {
        "gemini-2.5-flash-lite": _response(
            200,
            "gemini-2.5-flash-lite",
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": json.dumps({"words": [{"text": "oops"}]})}]
                        }
                    }
                ]
            },
        )
    }
    monkeypatch.setattr("app.services.gemini.httpx.AsyncClient", lambda timeout: FakeAsyncClient(responses))

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    with pytest.raises(ValueError, match="Unsupported transcript word payload"):
        asyncio.run(client.transcribe_translate(b"audio"))


def test_transcribe_translate_rejects_payload_without_words_collection(monkeypatch) -> None:
    responses = {
        "gemini-2.5-flash-lite": _response(
            200,
            "gemini-2.5-flash-lite",
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": json.dumps({"segments": []})}]
                        }
                    }
                ]
            },
        )
    }
    monkeypatch.setattr("app.services.gemini.httpx.AsyncClient", lambda timeout: FakeAsyncClient(responses))

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    with pytest.raises(ValueError, match="Unsupported transcript payload"):
        asyncio.run(client.transcribe_translate(b"audio"))


def test_translate_segments_accepts_object_items_with_translated_text(monkeypatch) -> None:
    responses = {
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
                                            "translations": [
                                                {
                                                    "speaker": "Speaker A",
                                                    "start_ms": 0,
                                                    "end_ms": 1000,
                                                    "translated_text": "Czesc",
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
        )
    }
    monkeypatch.setattr("app.services.gemini.httpx.AsyncClient", lambda timeout: FakeAsyncClient(responses))

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    payload = asyncio.run(
        client.translate_segments(
            [{"speaker": "Speaker A", "start_ms": 0, "end_ms": 1000, "original_text": "Hello"}]
        )
    )

    assert payload == ["Czesc"]


def test_translate_segments_rejects_malformed_translation_items(monkeypatch) -> None:
    responses = {
        "gemini-2.5-flash-lite": _response(
            200,
            "gemini-2.5-flash-lite",
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": json.dumps({"translations": [{"oops": "bad"}]})}]
                        }
                    }
                ]
            },
        )
    }
    monkeypatch.setattr("app.services.gemini.httpx.AsyncClient", lambda timeout: FakeAsyncClient(responses))

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    with pytest.raises(ValueError, match="Unsupported translation item payload"):
        asyncio.run(
            client.translate_segments(
                [{"speaker": "Speaker A", "start_ms": 0, "end_ms": 1000, "original_text": "Hello"}]
            )
        )


@pytest.mark.parametrize(
    "translations_payload",
    [
        {"translated_text": "Czesc"},
        "oops",
    ],
)
def test_translate_segments_rejects_malformed_translation_container(
    monkeypatch, translations_payload
) -> None:
    responses = {
        "gemini-2.5-flash-lite": _response(
            200,
            "gemini-2.5-flash-lite",
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": json.dumps({"translations": translations_payload})}]
                        }
                    }
                ]
            },
        )
    }
    monkeypatch.setattr("app.services.gemini.httpx.AsyncClient", lambda timeout: FakeAsyncClient(responses))

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    with pytest.raises(ValueError, match="Malformed translations payload"):
        asyncio.run(
            client.translate_segments(
                [{"speaker": "Speaker A", "start_ms": 0, "end_ms": 1000, "original_text": "Hello"}]
            )
        )


def test_transcribe_translate_uses_longer_timeout_for_audio_generation(monkeypatch) -> None:
    responses = {
        "gemini-2.5-flash-lite": _response(200, "gemini-2.5-flash-lite", {"candidates": [{"content": {"parts": [{"text": json.dumps({"words": []})}]}}]})
    }
    monkeypatch.setattr(
        "app.services.gemini.httpx.AsyncClient",
        lambda timeout: CapturingAsyncClient(responses, timeout=timeout),
    )

    client = GeminiClient()
    client.settings.gemini_api_key = "test-key"
    client.settings.gemini_model_text = "gemini-2.5-flash-lite"

    asyncio.run(client.transcribe_translate(b"audio"))

    assert CapturingAsyncClient.captured_timeout == 600.0
