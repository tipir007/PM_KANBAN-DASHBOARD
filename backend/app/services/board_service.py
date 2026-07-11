from pathlib import Path

from app.db.session import get_connection
from app.repositories.board_repository import BoardRepository
from app.schemas.board import BoardPayload


def _validate_username(username: str) -> None:
    if not username.strip():
        raise ValueError("username must not be empty")


class BoardService:
    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path

    def get_board(self, username: str) -> BoardPayload:
        _validate_username(username)
        with get_connection(self.db_path) as connection:
            return BoardRepository(connection).get_board(username)

    def save_board(self, username: str, board: BoardPayload) -> BoardPayload:
        _validate_username(username)
        with get_connection(self.db_path) as connection:
            return BoardRepository(connection).save_board(username, board)
