def _create_project(client, name: str, source_url: str) -> str:
    response = client.post(
        "/api/projects/import",
        json={"name": name, "source_url": source_url},
    )

    assert response.status_code == 202
    return response.json()["project_id"]


def test_library_routes_manage_folders_and_playlists(client) -> None:
    project_a = _create_project(client, "Alpha clip", "https://example.com/alpha")
    project_b = _create_project(client, "Beta clip", "https://example.com/beta")

    folder_response = client.post("/api/library/folders", json={"name": "Favorites"})
    assert folder_response.status_code == 201
    folder_id = folder_response.json()["id"]

    playlist_response = client.post("/api/library/playlists", json={"name": "Morning watch"})
    assert playlist_response.status_code == 201
    playlist_id = playlist_response.json()["id"]

    assign_response = client.post(
        f"/api/library/projects/{project_a}/folder",
        json={"folder_id": folder_id},
    )
    assert assign_response.status_code == 200
    assert assign_response.json()["folder_id"] == folder_id

    first_item = client.post(
        f"/api/library/playlists/{playlist_id}/items",
        json={"project_id": project_a},
    )
    second_item = client.post(
        f"/api/library/playlists/{playlist_id}/items",
        json={"project_id": project_b},
    )
    assert first_item.status_code == 201
    assert second_item.status_code == 201

    reorder_response = client.patch(
        f"/api/library/playlists/{playlist_id}/items/reorder",
        json={"project_ids": [project_b, project_a]},
    )
    assert reorder_response.status_code == 200
    assert [item["project_id"] for item in reorder_response.json()["items"]] == [project_b, project_a]

    delete_response = client.delete(f"/api/library/playlists/{playlist_id}/items/{project_a}")
    assert delete_response.status_code == 204

    library_response = client.get("/api/library")
    assert library_response.status_code == 200
    payload = library_response.json()

    assert payload["folders"] == [
        {"id": folder_id, "name": "Favorites", "project_ids": [project_a]}
    ]
    assert payload["playlists"] == [
        {
            "id": playlist_id,
            "name": "Morning watch",
            "items": [{"project_id": project_b, "position": 1}],
        }
    ]
    assert any(project["id"] == project_a and project["folder_id"] == folder_id for project in payload["projects"])


def test_delete_project_removes_it_from_library_views(client) -> None:
    project_id = _create_project(client, "Disposable clip", "https://example.com/disposable")

    response = client.delete(f"/api/projects/{project_id}")

    assert response.status_code == 204
    library_response = client.get("/api/library")
    assert library_response.status_code == 200
    assert library_response.json()["projects"] == []
