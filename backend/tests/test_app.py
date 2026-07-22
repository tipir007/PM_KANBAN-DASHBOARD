import sqlite3
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.bootstrap import init_database
from app.main import app


class _FakeOpenRouterResponse:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self._body = body
        self.text = json.dumps(body)

    def json(self) -> dict:
        return self._body


@pytest.fixture
def client(tmp_path: Path):
    original_db_path = settings.db_path
    settings.db_path = tmp_path / "test.db"
    with TestClient(app) as test_client:
        yield test_client
    settings.db_path = original_db_path


def test_db_bootstrap_creates_tables(tmp_path: Path) -> None:
    db_path = tmp_path / "bootstrap.db"
    init_database(db_path)
    with sqlite3.connect(db_path) as connection:
        names = {
            row[0]
            for row in connection.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                """
            ).fetchall()
        }
    assert {"users", "boards", "columns", "cards"}.issubset(names)


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_hello_endpoint(client: TestClient) -> None:
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "hello world"}


def test_root_route_serves_html(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_unknown_api_route_returns_404(client: TestClient) -> None:
    response = client.get("/api/not-found")
    assert response.status_code == 404


def test_get_board_for_default_user(client: TestClient) -> None:
    response = client.get("/api/board")
    assert response.status_code == 200
    payload = response.json()
    assert payload["username"] == "user"
    assert len(payload["board"]["columns"]) == 5
    assert len(payload["board"]["cards"]) == 8


def test_put_board_persists_changes(client: TestClient) -> None:
    next_board = {
        "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "Single task", "details": "Persisted"}},
    }

    write_response = client.put("/api/board?username=user", json=next_board)
    assert write_response.status_code == 200

    read_response = client.get("/api/board?username=user")
    assert read_response.status_code == 200
    assert read_response.json()["board"] == next_board


def test_put_board_rejects_dangling_card_reference(client: TestClient) -> None:
    invalid_board = {
        "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": ["card-missing"]}],
        "cards": {},
    }
    response = client.put("/api/board", json=invalid_board)
    assert response.status_code == 422


def test_put_board_rejects_duplicate_card_reference(client: TestClient) -> None:
    invalid_board = {
        "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "Task", "details": ""}},
    }
    response = client.put("/api/board", json=invalid_board)
    assert response.status_code == 422


def test_put_board_rejects_duplicate_column_id(client: TestClient) -> None:
    invalid_board = {
        "columns": [
            {"id": "col-backlog", "title": "Backlog", "cardIds": []},
            {"id": "col-backlog", "title": "Backlog Again", "cardIds": []},
        ],
        "cards": {},
    }
    response = client.put("/api/board", json=invalid_board)
    assert response.status_code == 422


def test_get_board_rejects_empty_username(client: TestClient) -> None:
    response = client.get("/api/board?username=%20")
    assert response.status_code == 400


def test_ai_chat_returns_runtime_error_when_api_key_missing(client: TestClient) -> None:
    original_key = settings.openrouter_api_key
    settings.openrouter_api_key = None
    try:
        response = client.post(
            "/api/ai/chat",
            json={
                "username": "user",
                "question": "What is 2+2?",
                "conversation": [],
            },
        )
    finally:
        settings.openrouter_api_key = original_key

    assert response.status_code == 503
    assert "OPENROUTER_API_KEY" in response.json()["detail"]


def test_ai_chat_response_only_path_uses_structured_output(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    captured_request: dict = {}

    def fake_openrouter_post(url: str, headers: dict, json: dict, timeout: float) -> _FakeOpenRouterResponse:
        captured_request["url"] = url
        captured_request["headers"] = headers
        captured_request["json"] = json
        captured_request["timeout"] = timeout
        return _FakeOpenRouterResponse(
            200,
            {
                "choices": [
                    {
                        "message": {
                            "content": '{"response":"No board change needed","board_update":null}'
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("app.services.ai_service.httpx.post", fake_openrouter_post)

    original_key = settings.openrouter_api_key
    settings.openrouter_api_key = "test-key"
    try:
        response = client.post(
            "/api/ai/chat",
            json={
                "username": "user",
                "question": "Summarize board status.",
                "conversation": [{"role": "assistant", "content": "Previous response"}],
            },
        )
    finally:
        settings.openrouter_api_key = original_key

    assert response.status_code == 200
    payload = response.json()
    assert payload["response"] == "No board change needed"
    assert payload["board_update"] is None
    assert captured_request["json"]["messages"][0]["content"] == "Previous response"
    assert "Current Kanban board JSON" in captured_request["json"]["messages"][-1]["content"]


def test_ai_chat_valid_board_update_path_persists_changes(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    updated_board = {
        "columns": [{"id": "todo", "title": "Todo", "cardIds": ["card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "AI task", "details": "Created by AI"}},
    }

    def fake_openrouter_post(url: str, headers: dict, json: dict, timeout: float) -> _FakeOpenRouterResponse:
        return _FakeOpenRouterResponse(
            200,
            {
                "choices": [
                    {
                        "message": {
                            "content": json_module.dumps(
                                {"response": "Applied update", "board_update": updated_board}
                            )
                        }
                    }
                ]
            },
        )

    # Keep a stable alias to avoid shadowing the `json` argument in fake_openrouter_post.
    json_module = json
    monkeypatch.setattr("app.services.ai_service.httpx.post", fake_openrouter_post)

    original_key = settings.openrouter_api_key
    settings.openrouter_api_key = "test-key"
    try:
        response = client.post(
            "/api/ai/chat",
            json={
                "username": "user",
                "question": "Move one task into Todo.",
                "conversation": [],
            },
        )
    finally:
        settings.openrouter_api_key = original_key

    assert response.status_code == 200
    payload = response.json()
    assert payload["response"] == "Applied update"
    assert payload["board_update"] == updated_board

    board_response = client.get("/api/board?username=user")
    assert board_response.status_code == 200
    assert board_response.json()["board"] == updated_board


def test_ai_chat_rejects_invalid_structured_output(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_openrouter_post(url: str, headers: dict, json: dict, timeout: float) -> _FakeOpenRouterResponse:
        return _FakeOpenRouterResponse(
            200,
            {"choices": [{"message": {"content": "This is not JSON structured output"}}]},
        )

    monkeypatch.setattr("app.services.ai_service.httpx.post", fake_openrouter_post)

    original_key = settings.openrouter_api_key
    settings.openrouter_api_key = "test-key"
    try:
        response = client.post(
            "/api/ai/chat",
            json={
                "username": "user",
                "question": "Do anything you want.",
                "conversation": [],
            },
        )
    finally:
        settings.openrouter_api_key = original_key

    assert response.status_code == 502
    assert "structured JSON output" in response.json()["detail"]


def test_ai_chat_live_connectivity_returns_model_answer(client: TestClient) -> None:
    if not settings.openrouter_live_test_enabled:
        pytest.skip("Set OPENROUTER_LIVE_TEST_ENABLED=true to run live OpenRouter test.")
    if not settings.openrouter_api_key:
        pytest.skip("Set OPENROUTER_API_KEY in project .env before running live test.")

    response = client.post(
        "/api/ai/chat",
        json={
            "username": "user",
            "question": "What is 2+2? Reply with only the number.",
            "conversation": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["response"].strip()
    assert "4" in payload["response"]
    assert payload["board_update"] is None


def test_ai_chat_live_invalid_key_returns_runtime_error(client: TestClient) -> None:
    if not settings.openrouter_live_test_enabled:
        pytest.skip("Set OPENROUTER_LIVE_TEST_ENABLED=true to run live OpenRouter test.")

    original_key = settings.openrouter_api_key
    settings.openrouter_api_key = "invalid-openrouter-key"
    try:
        response = client.post(
            "/api/ai/chat",
            json={
                "username": "user",
                "question": "What is 2+2?",
                "conversation": [],
            },
        )
    finally:
        settings.openrouter_api_key = original_key

    assert response.status_code == 502
    assert "rejected the API key" in response.json()["detail"]
