from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


class _FakeResponse:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self._body = body
        self.text = str(body)

    def json(self) -> dict:
        return self._body


@pytest.fixture
def client(tmp_path: Path):
    original_db_path = settings.db_path
    settings.db_path = tmp_path / "ai_scope.db"
    with TestClient(app) as test_client:
        yield test_client
    settings.db_path = original_db_path


def _register(client: TestClient, username: str) -> str:
    return client.post(
        "/api/auth/register", json={"username": username, "password": "pw123456"}
    ).json()["token"]


def _fake_update_response(url, headers, json, timeout) -> _FakeResponse:
    # Echo back a board_update that clears the board to a single empty column.
    content = (
        '{"response":"Updated your board",'
        '"board_update":{"columns":[{"id":"only","title":"Only","cardIds":[]}],"cards":{}}}'
    )
    return _FakeResponse(200, {"choices": [{"message": {"content": content}}]})


def test_ai_chat_updates_the_targeted_board(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _register(client, "alice")
    headers = {"Authorization": f"Bearer {_register(client, 'aliceboards')}"}
    board_id = client.post("/api/boards", json={"name": "Planning"}, headers=headers).json()["id"]

    monkeypatch.setattr("app.services.ai_service.httpx.post", _fake_update_response)
    original_key = settings.openrouter_api_key
    settings.openrouter_api_key = "test-key"
    try:
        response = client.post(
            "/api/ai/chat",
            json={
                "username": "aliceboards",
                "board_id": board_id,
                "question": "Clear the board.",
                "conversation": [],
            },
        )
    finally:
        settings.openrouter_api_key = original_key

    assert response.status_code == 200
    body = response.json()
    assert body["board_update"]["columns"][0]["title"] == "Only"

    # The change persisted to that specific board.
    stored = client.get(f"/api/boards/{board_id}", headers=headers).json()
    assert [c["title"] for c in stored["board"]["columns"]] == ["Only"]


def test_ai_chat_rejects_board_not_owned(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner_headers = {"Authorization": f"Bearer {_register(client, 'owner')}"}
    _register(client, "intruder")
    board_id = client.post(
        "/api/boards", json={"name": "Private"}, headers=owner_headers
    ).json()["id"]

    monkeypatch.setattr("app.services.ai_service.httpx.post", _fake_update_response)
    original_key = settings.openrouter_api_key
    settings.openrouter_api_key = "test-key"
    try:
        response = client.post(
            "/api/ai/chat",
            json={
                "username": "intruder",
                "board_id": board_id,
                "question": "Wipe it.",
                "conversation": [],
            },
        )
    finally:
        settings.openrouter_api_key = original_key

    assert response.status_code == 404
