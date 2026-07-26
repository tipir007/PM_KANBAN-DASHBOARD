from pathlib import Path

from app.db.session import get_connection
from app.repositories.board_repository import BoardRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse


class AuthError(Exception):
    """Raised when registration or login cannot proceed."""


class AuthService:
    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path

    def register(self, username: str, password: str) -> AuthResponse:
        username = username.strip()
        if not username:
            raise AuthError("username must not be empty")
        with get_connection(self.db_path) as connection:
            repository = UserRepository(connection)
            if repository.username_exists(username):
                raise AuthError("username already taken")
            user_id = repository.create_user(username, password)
            token = repository.create_session(user_id)
            # Every new user starts with one usable board named "My Board".
            BoardRepository(connection).create_board(username, "My Board")
        return AuthResponse(token=token, username=username)

    def login(self, username: str, password: str) -> AuthResponse:
        username = username.strip()
        with get_connection(self.db_path) as connection:
            repository = UserRepository(connection)
            user_id = repository.verify_credentials(username, password)
            if user_id is None:
                raise AuthError("invalid username or password")
            token = repository.create_session(user_id)
        return AuthResponse(token=token, username=username)

    def logout(self, token: str) -> None:
        with get_connection(self.db_path) as connection:
            UserRepository(connection).delete_session(token)

    def username_for_token(self, token: str) -> str | None:
        with get_connection(self.db_path) as connection:
            return UserRepository(connection).username_for_token(token)
