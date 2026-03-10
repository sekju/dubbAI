from unittest.mock import Mock


def test_upload_project_creates_persisted_project_and_job(client) -> None:
    response = client.post(
        "/api/projects/upload",
        data={"name": "Clip upload"},
        files={"file": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["state"] == "queued"
    assert payload["project_id"]
    assert payload["job_id"]

    projects = client.get("/api/projects")
    assert projects.status_code == 200
    assert projects.json() == [
        {
            "id": payload["project_id"],
            "name": "Clip upload",
            "source_type": "upload",
            "source_url": f"/storage/uploads/{payload['project_id']}/clip.mp4",
            "status": "uploaded",
            "transcript_segments": [],
        }
    ]

    job = client.get(f"/api/jobs/{payload['job_id']}")
    assert job.status_code == 200
    assert job.json() == {
        "job_id": payload["job_id"],
        "project_id": payload["project_id"],
        "state": "queued",
        "progress": 0,
        "queue": "app.tasks.ingest.ingest_source",
    }


def test_url_project_creates_detail_record(client) -> None:
    response = client.post(
        "/api/projects/import",
        json={"name": "Remote clip", "source_url": "https://example.com/video"},
    )

    assert response.status_code == 202
    payload = response.json()

    detail = client.get(f"/api/projects/{payload['project_id']}")

    assert detail.status_code == 200
    assert detail.json() == {
        "id": payload["project_id"],
        "name": "Remote clip",
        "source_type": "url",
        "source_url": "https://example.com/video",
        "status": "queued",
        "transcript_segments": [],
    }


def test_transcribe_endpoint_creates_ai_job_and_dispatches_task(client, monkeypatch) -> None:
    create_response = client.post(
        "/api/projects/import",
        json={"name": "Transcribe me", "source_url": "https://example.com/video"},
    )
    project_id = create_response.json()["project_id"]

    delay_mock = Mock()
    monkeypatch.setattr("app.api.routes.projects.transcribe_project_task.delay", delay_mock)

    response = client.post(f"/api/projects/{project_id}/transcribe")

    assert response.status_code == 202
    payload = response.json()
    assert payload["queue"] == "app.tasks.ai.transcribe_project"
    delay_mock.assert_called_once_with(payload["job_id"], project_id)

    detail = client.get(f"/api/projects/{project_id}")

    assert detail.status_code == 200
    assert detail.json()["status"] == "transcription_queued"
