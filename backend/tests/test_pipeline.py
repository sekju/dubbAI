from app.services.pipeline import parse_transcript_payload


def test_parse_transcript_payload_accepts_word_key_from_gemini() -> None:
    payload = {
        "segments": [
            {
                "speaker": "Speaker A",
                "start_ms": 0,
                "end_ms": 1000,
                "original_text": "Hello world",
                "translated_text": "Czesc swiecie",
                "words": [
                    {"word": "Hello", "start_ms": 0, "end_ms": 400},
                    {"word": "world", "start_ms": 400, "end_ms": 1000},
                ],
            }
        ]
    }

    chunks = parse_transcript_payload(payload)

    assert [word.text for word in chunks[0].words] == ["Hello", "world"]
