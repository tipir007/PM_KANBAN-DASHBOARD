from datetime import UTC, datetime
from sqlite3 import Connection
from uuid import uuid4

from app.core.security import generate_token, hash_password, verify_password


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


class UserRepository:
    """Reads/writes for users and their auth sessions."""

    def __init__(self, connection: Connection):
        self.connection = connection

    def username_exists(self, username: str) -> bool:
        row = self.connection.execute(
            "SELECT 1 FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return row is not None

    def create_user(self, username: str, password: str) -> str:
        user_id = f"user-{uuid4().hex[:12]}"
        self.connection.execute(
            "INSERT INTO users(id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, username, hash_password(password), _utc_now()),
        )
        return user_id

    def verify_credentials(self, username: str, password: str) -> str | None:
        row = self.connection.execute(
            "SELECT id, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            return None
        if not verify_password(password, str(row["password_hash"])):
            return None
        return str(row["id"])

    def create_session(self, user_id: str) -> str:
        token = generate_token()
        self.connection.execute(
            "INSERT INTO sessions(token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, _utc_now()),
        )
        return token

    def delete_session(self, token: str) -> None:
        self.connection.execute("DELETE FROM sessions WHERE token = ?", (token,))

    def username_for_token(self, token: str) -> str | None:
        row = self.connection.execute(
            """
            SELECT users.username AS username
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
        return str(row["username"]) if row else None
