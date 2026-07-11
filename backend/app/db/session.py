from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
import sqlite3

from app.core.config import settings


def _ensure_db_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_connection(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    path = db_path or settings.db_path
    _ensure_db_parent(path)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
