from pathlib import Path

from app.db.schema import create_schema, seed_default_data
from app.db.session import get_connection


def init_database(db_path: Path | None = None) -> None:
    with get_connection(db_path) as connection:
        create_schema(connection)
        seed_default_data(connection)
