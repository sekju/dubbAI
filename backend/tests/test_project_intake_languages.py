def _project_detail(client, project_id: str) -> dict[str, object]:
    response = client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    return response.json()


def test_upload_intake_accepts_source_and_target_languages(client) -> None:
    response = client.post(
        "/api/projects/upload",
        data={
            "name": "Upload with languages",
            "source_language": "ja",
            "target_language": "en",
        },
        files={"file": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
    )

    assert response.status_code == 202
    detail = _project_detail(client, response.json()["project_id"])
    assert detail["source_language"] == "ja"
    assert detail["target_language"] == "en"


def test_url_intake_accepts_source_and_target_languages(client) -> None:
    response = client.post(
        "/api/projects/import",
        json={
            "name": "URL with languages",
            "source_url": "https://example.com/video",
            "source_language": "de",
            "target_language": "fr",
        },
    )

    assert response.status_code == 202
    detail = _project_detail(client, response.json()["project_id"])
    assert detail["source_language"] == "de"
    assert detail["target_language"] == "fr"


def test_upload_intake_defaults_english_source_to_polish_target(client) -> None:
    response = client.post(
        "/api/projects/upload",
        data={"name": "English upload", "source_language": "en"},
        files={"file": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
    )

    assert response.status_code == 202
    detail = _project_detail(client, response.json()["project_id"])
    assert detail["source_language"] == "en"
    assert detail["target_language"] == "pl"


def test_url_intake_defaults_polish_source_to_english_target(client) -> None:
    response = client.post(
        "/api/projects/import",
        json={
            "name": "Polish URL",
            "source_url": "https://example.com/video",
            "source_language": "pl",
        },
    )

    assert response.status_code == 202
    detail = _project_detail(client, response.json()["project_id"])
    assert detail["source_language"] == "pl"
    assert detail["target_language"] == "en"


def test_explicit_non_default_target_language_is_preserved(client) -> None:
    response = client.post(
        "/api/projects/import",
        json={
            "name": "English to German",
            "source_url": "https://example.com/video",
            "source_language": "en",
            "target_language": "de",
        },
    )

    assert response.status_code == 202
    detail = _project_detail(client, response.json()["project_id"])
    assert detail["source_language"] == "en"
    assert detail["target_language"] == "de"
