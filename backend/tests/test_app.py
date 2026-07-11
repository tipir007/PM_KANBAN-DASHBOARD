import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.bootstrap import init_database
from app.main import app


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


def test_get_board_rejects_empty_username(client: TestClient) -> None:
    response = client.get("/api/board?username=%20")
    assert response.status_code == 400
