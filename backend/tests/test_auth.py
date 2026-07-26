from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.main import app


@pytest.fixture
def client(tmp_path: Path):
    original_db_path = settings.db_path
    settings.db_path = tmp_path / "auth.db"
    with TestClient(app) as test_client:
        yield test_client
    settings.db_path = original_db_path


def test_password_hash_roundtrip() -> None:
    stored = hash_password("s3cret")
    assert stored != "s3cret"
    assert verify_password("s3cret", stored) is True
    assert verify_password("wrong", stored) is False


def test_register_and_me(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register", json={"username": "alice", "password": "pw12345"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "alice"
    token = body["token"]
    assert token

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json() == {"username": "alice"}


def test_login_success_and_wrong_password(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "bob", "password": "hunter2"})

    ok = client.post("/api/auth/login", json={"username": "bob", "password": "hunter2"})
    assert ok.status_code == 200
    assert ok.json()["username"] == "bob"

    bad = client.post("/api/auth/login", json={"username": "bob", "password": "nope"})
    assert bad.status_code == 401


def test_register_duplicate_username_conflicts(client: TestClient) -> None:
    first = client.post(
        "/api/auth/register", json={"username": "carol", "password": "pw123456"}
    )
    assert first.status_code == 201
    dup = client.post(
        "/api/auth/register", json={"username": "carol", "password": "different"}
    )
    assert dup.status_code == 409


def test_me_requires_valid_token(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
        ).status_code
        == 401
    )


def test_logout_invalidates_token(client: TestClient) -> None:
    token = client.post(
        "/api/auth/register", json={"username": "dave", "password": "pw123456"}
    ).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_seed_user_can_login_with_default_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    assert response.status_code == 200
    assert response.json()["username"] == "user"
