from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


@pytest.fixture
def client(tmp_path: Path):
    original_db_path = settings.db_path
    settings.db_path = tmp_path / "boards.db"
    with TestClient(app) as test_client:
        yield test_client
    settings.db_path = original_db_path


def _register(client: TestClient, username: str, password: str = "pw123456") -> dict[str, str]:
    token = client.post(
        "/api/auth/register", json={"username": username, "password": password}
    ).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_boards_requires_auth(client: TestClient) -> None:
    assert client.get("/api/boards").status_code == 401


def test_new_user_has_one_default_board(client: TestClient) -> None:
    headers = _register(client, "alice")
    response = client.get("/api/boards", headers=headers)
    assert response.status_code == 200
    boards = response.json()["boards"]
    assert len(boards) == 1
    assert boards[0]["name"]


def test_create_list_rename_delete_flow(client: TestClient) -> None:
    headers = _register(client, "bob")

    created = client.post("/api/boards", json={"name": "Roadmap"}, headers=headers)
    assert created.status_code == 201
    board_id = created.json()["id"]
    assert created.json()["name"] == "Roadmap"

    # New board is seeded with usable default columns.
    content = client.get(f"/api/boards/{board_id}", headers=headers)
    assert content.status_code == 200
    assert len(content.json()["board"]["columns"]) == 3

    listed = client.get("/api/boards", headers=headers).json()["boards"]
    assert {b["name"] for b in listed} == {"My Board", "Roadmap"}

    renamed = client.patch(
        f"/api/boards/{board_id}", json={"name": "Q3 Roadmap"}, headers=headers
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Q3 Roadmap"

    deleted = client.delete(f"/api/boards/{board_id}", headers=headers)
    assert deleted.status_code == 204
    remaining = client.get("/api/boards", headers=headers).json()["boards"]
    assert [b["name"] for b in remaining] == ["My Board"]


def test_cannot_delete_only_board(client: TestClient) -> None:
    headers = _register(client, "carol")
    only_board = client.get("/api/boards", headers=headers).json()["boards"][0]["id"]
    response = client.delete(f"/api/boards/{only_board}", headers=headers)
    assert response.status_code == 409


def test_update_board_content_roundtrips(client: TestClient) -> None:
    headers = _register(client, "dave")
    board_id = client.post("/api/boards", json={"name": "Work"}, headers=headers).json()["id"]

    payload = {
        "columns": [{"id": "c1", "title": "Todo", "cardIds": ["k1"]}],
        "cards": {"k1": {"id": "k1", "title": "First task", "details": "do it"}},
    }
    saved = client.put(f"/api/boards/{board_id}", json=payload, headers=headers)
    assert saved.status_code == 200
    body = saved.json()["board"]
    assert body["columns"][0]["cardIds"] == ["k1"]
    assert body["cards"]["k1"]["title"] == "First task"


def test_user_cannot_access_another_users_board(client: TestClient) -> None:
    owner = _register(client, "erin")
    intruder = _register(client, "frank")

    board_id = client.post("/api/boards", json={"name": "Secret"}, headers=owner).json()["id"]

    assert client.get(f"/api/boards/{board_id}", headers=intruder).status_code == 404
    assert (
        client.patch(
            f"/api/boards/{board_id}", json={"name": "Hijacked"}, headers=intruder
        ).status_code
        == 404
    )
    assert client.delete(f"/api/boards/{board_id}", headers=intruder).status_code == 404
    # Owner still sees the original name.
    assert client.get(f"/api/boards/{board_id}", headers=owner).json()["name"] == "Secret"


def test_get_missing_board_returns_404(client: TestClient) -> None:
    headers = _register(client, "grace")
    assert client.get("/api/boards/board-does-not-exist", headers=headers).status_code == 404
