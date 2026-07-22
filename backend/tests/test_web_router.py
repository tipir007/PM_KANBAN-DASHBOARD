from pathlib import Path

import pytest

import app.web.router as web_router
from app.web.router import resolve_static_file


@pytest.fixture
def static_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    directory = tmp_path / "static"
    directory.mkdir()
    (directory / "app.js").write_text("console.log('ok');", encoding="utf-8")
    monkeypatch.setattr(web_router, "STATIC_DIR", directory)
    return directory


def test_resolve_static_file_returns_file_within_static_dir(static_dir: Path) -> None:
    resolved = resolve_static_file("app.js")

    assert resolved == (static_dir / "app.js").resolve()


def test_resolve_static_file_rejects_path_traversal(static_dir: Path) -> None:
    secret = static_dir.parent / "secret.txt"
    secret.write_text("do not serve me", encoding="utf-8")

    resolved = resolve_static_file("../secret.txt")

    assert resolved is None
