from pathlib import Path

from app.db.session import get_connection
from app.repositories.board_repository import BoardRepository
from app.schemas.board import BoardPayload, BoardSummary


def _validate_username(username: str) -> None:
    if not username.strip():
        raise ValueError("username must not be empty")


class BoardNotFoundError(Exception):
    """Raised when a board does not exist or is not owned by the requesting user."""


class LastBoardError(Exception):
    """Raised when attempting to delete a user's only remaining board."""


class BoardService:
    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path

    # ------------------------------------------------------ legacy single board
    def get_board(self, username: str) -> BoardPayload:
        _validate_username(username)
        with get_connection(self.db_path) as connection:
            return BoardRepository(connection).get_board(username)

    def save_board(self, username: str, board: BoardPayload) -> BoardPayload:
        _validate_username(username)
        with get_connection(self.db_path) as connection:
            return BoardRepository(connection).save_board(username, board)

    # ------------------------------------------------------------- board management
    def list_boards(self, username: str) -> list[BoardSummary]:
        _validate_username(username)
        with get_connection(self.db_path) as connection:
            return BoardRepository(connection).list_boards(username)

    def create_board(self, username: str, name: str) -> BoardSummary:
        _validate_username(username)
        if not name.strip():
            raise ValueError("board name must not be empty")
        with get_connection(self.db_path) as connection:
            return BoardRepository(connection).create_board(username, name.strip())

    def _require_owned(self, repository: BoardRepository, username: str, board_id: str) -> None:
        owner = repository.owner_username(board_id)
        if owner != username:
            raise BoardNotFoundError(board_id)

    def get_board_by_id(self, username: str, board_id: str) -> tuple[str, BoardPayload]:
        _validate_username(username)
        with get_connection(self.db_path) as connection:
            repository = BoardRepository(connection)
            self._require_owned(repository, username, board_id)
            name = repository.board_name(board_id) or ""
            return name, repository.get_board_by_id(board_id)

    def save_board_by_id(
        self, username: str, board_id: str, board: BoardPayload
    ) -> tuple[str, BoardPayload]:
        _validate_username(username)
        with get_connection(self.db_path) as connection:
            repository = BoardRepository(connection)
            self._require_owned(repository, username, board_id)
            saved = repository.save_board_by_id(board_id, board)
            name = repository.board_name(board_id) or ""
            return name, saved

    def rename_board(self, username: str, board_id: str, name: str) -> BoardSummary:
        _validate_username(username)
        if not name.strip():
            raise ValueError("board name must not be empty")
        with get_connection(self.db_path) as connection:
            repository = BoardRepository(connection)
            self._require_owned(repository, username, board_id)
            repository.rename_board(board_id, name.strip())
            boards = repository.list_boards(username)
            for summary in boards:
                if summary.id == board_id:
                    return summary
            raise BoardNotFoundError(board_id)

    def delete_board(self, username: str, board_id: str) -> None:
        _validate_username(username)
        with get_connection(self.db_path) as connection:
            repository = BoardRepository(connection)
            self._require_owned(repository, username, board_id)
            if repository.count_boards_for_owner(board_id) <= 1:
                raise LastBoardError(board_id)
            repository.delete_board(board_id)
