from datetime import UTC, datetime
from sqlite3 import Connection
from uuid import uuid4

from app.schemas.board import BoardPayload, BoardSummary, CardPayload, ColumnPayload


# Columns seeded when a user creates a brand-new board so it is immediately usable.
DEFAULT_NEW_BOARD_COLUMNS = ("Backlog", "In Progress", "Done")


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


class BoardRepository:
    def __init__(self, connection: Connection):
        self.connection = connection

    # ------------------------------------------------------------------ users
    def _get_user_id(self, username: str) -> str | None:
        row = self.connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return str(row["id"]) if row else None

    def _create_user(self, username: str) -> str:
        user_id = f"user-{uuid4().hex[:12]}"
        self.connection.execute(
            "INSERT INTO users(id, username, created_at) VALUES (?, ?, ?)",
            (user_id, username, _utc_now()),
        )
        return user_id

    # ----------------------------------------------------------------- boards
    def _get_first_board_id(self, user_id: str) -> str | None:
        row = self.connection.execute(
            "SELECT id FROM boards WHERE user_id = ? ORDER BY position ASC, created_at ASC LIMIT 1",
            (user_id,),
        ).fetchone()
        return str(row["id"]) if row else None

    def _next_board_position(self, user_id: str) -> int:
        row = self.connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM boards WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return int(row["next"])

    def _insert_board(self, user_id: str, name: str, seed_columns: bool) -> str:
        board_id = f"board-{uuid4().hex[:12]}"
        now = _utc_now()
        position = self._next_board_position(user_id)
        self.connection.execute(
            """
            INSERT INTO boards(id, user_id, name, position, metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, ?, ?)
            """,
            (board_id, user_id, name, position, now, now),
        )
        if seed_columns:
            for index, title in enumerate(DEFAULT_NEW_BOARD_COLUMNS):
                self.connection.execute(
                    """
                    INSERT INTO columns(id, board_id, title, position, metadata_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, NULL, ?, ?)
                    """,
                    (f"col-{uuid4().hex[:12]}", board_id, title, index, now, now),
                )
        return board_id

    def ensure_user_board(self, username: str) -> str:
        user_id = self._get_user_id(username)
        if user_id is None:
            user_id = self._create_user(username)
        board_id = self._get_first_board_id(user_id)
        if board_id is None:
            board_id = self._insert_board(user_id, "My Board", seed_columns=False)
        return board_id

    def list_boards(self, username: str) -> list[BoardSummary]:
        self.ensure_user_board(username)  # guarantees the user has at least one board
        user_id = self._get_user_id(username)
        rows = self.connection.execute(
            "SELECT id, name, position FROM boards WHERE user_id = ? ORDER BY position ASC, created_at ASC",
            (user_id,),
        ).fetchall()
        return [
            BoardSummary(id=str(row["id"]), name=str(row["name"]), position=int(row["position"]))
            for row in rows
        ]

    def create_board(self, username: str, name: str) -> BoardSummary:
        user_id = self._get_user_id(username)
        if user_id is None:
            user_id = self._create_user(username)
        board_id = self._insert_board(user_id, name, seed_columns=True)
        row = self.connection.execute(
            "SELECT id, name, position FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        return BoardSummary(id=str(row["id"]), name=str(row["name"]), position=int(row["position"]))

    def owner_username(self, board_id: str) -> str | None:
        row = self.connection.execute(
            """
            SELECT users.username AS username
            FROM boards
            JOIN users ON users.id = boards.user_id
            WHERE boards.id = ?
            """,
            (board_id,),
        ).fetchone()
        return str(row["username"]) if row else None

    def board_name(self, board_id: str) -> str | None:
        row = self.connection.execute(
            "SELECT name FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        return str(row["name"]) if row else None

    def count_boards_for_owner(self, board_id: str) -> int:
        row = self.connection.execute(
            """
            SELECT COUNT(*) AS total
            FROM boards
            WHERE user_id = (SELECT user_id FROM boards WHERE id = ?)
            """,
            (board_id,),
        ).fetchone()
        return int(row["total"]) if row else 0

    def rename_board(self, board_id: str, name: str) -> None:
        self.connection.execute(
            "UPDATE boards SET name = ?, updated_at = ? WHERE id = ?",
            (name, _utc_now(), board_id),
        )

    def delete_board(self, board_id: str) -> None:
        # cards and columns cascade via ON DELETE CASCADE
        self.connection.execute("DELETE FROM boards WHERE id = ?", (board_id,))

    # --------------------------------------------------------- board content
    def _read_board(self, board_id: str) -> BoardPayload:
        column_rows = self.connection.execute(
            "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position ASC",
            (board_id,),
        ).fetchall()

        card_rows = self.connection.execute(
            """
            SELECT id, column_id, title, details
            FROM cards
            WHERE board_id = ?
            ORDER BY column_id ASC, position ASC
            """,
            (board_id,),
        ).fetchall()

        cards: dict[str, CardPayload] = {}
        card_ids_by_column: dict[str, list[str]] = {}
        for row in card_rows:
            card_id = str(row["id"])
            column_id = str(row["column_id"])
            cards[card_id] = CardPayload(
                id=card_id,
                title=str(row["title"]),
                details=str(row["details"]),
            )
            card_ids_by_column.setdefault(column_id, []).append(card_id)

        columns = [
            ColumnPayload(
                id=str(row["id"]),
                title=str(row["title"]),
                cardIds=card_ids_by_column.get(str(row["id"]), []),
            )
            for row in column_rows
        ]
        return BoardPayload(columns=columns, cards=cards)

    def _write_board(self, board_id: str, board: BoardPayload) -> None:
        now = _utc_now()
        self.connection.execute("DELETE FROM cards WHERE board_id = ?", (board_id,))
        self.connection.execute("DELETE FROM columns WHERE board_id = ?", (board_id,))

        for index, column in enumerate(board.columns):
            self.connection.execute(
                """
                INSERT INTO columns(id, board_id, title, position, metadata_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, NULL, ?, ?)
                """,
                (column.id, board_id, column.title, index, now, now),
            )
            for card_position, card_id in enumerate(column.cardIds):
                card = board.cards[card_id]
                self.connection.execute(
                    """
                    INSERT INTO cards(id, board_id, column_id, title, details, position, metadata_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
                    """,
                    (card.id, board_id, column.id, card.title, card.details, card_position, now, now),
                )

        self.connection.execute(
            "UPDATE boards SET updated_at = ? WHERE id = ?",
            (now, board_id),
        )

    def get_board_by_id(self, board_id: str) -> BoardPayload:
        return self._read_board(board_id)

    def save_board_by_id(self, board_id: str, board: BoardPayload) -> BoardPayload:
        self._write_board(board_id, board)
        return self._read_board(board_id)

    # ----------------------------------------------------- legacy (username)
    def get_board(self, username: str) -> BoardPayload:
        board_id = self.ensure_user_board(username)
        return self._read_board(board_id)

    def save_board(self, username: str, board: BoardPayload) -> BoardPayload:
        board_id = self.ensure_user_board(username)
        self._write_board(board_id, board)
        return self._read_board(board_id)
