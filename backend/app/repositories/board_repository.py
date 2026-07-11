from datetime import UTC, datetime
from sqlite3 import Connection
from uuid import uuid4

from app.schemas.board import BoardPayload, CardPayload, ColumnPayload


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


class BoardRepository:
    def __init__(self, connection: Connection):
        self.connection = connection

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

    def _get_board_id(self, user_id: str) -> str | None:
        row = self.connection.execute(
            "SELECT id FROM boards WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return str(row["id"]) if row else None

    def _create_empty_board(self, user_id: str) -> str:
        board_id = f"board-{uuid4().hex[:12]}"
        now = _utc_now()
        self.connection.execute(
            """
            INSERT INTO boards(id, user_id, name, metadata_json, created_at, updated_at)
            VALUES (?, ?, 'My Board', NULL, ?, ?)
            """,
            (board_id, user_id, now, now),
        )
        return board_id

    def ensure_user_board(self, username: str) -> str:
        user_id = self._get_user_id(username)
        if user_id is None:
            user_id = self._create_user(username)

        board_id = self._get_board_id(user_id)
        if board_id is None:
            board_id = self._create_empty_board(user_id)
        return board_id

    def get_board(self, username: str) -> BoardPayload:
        board_id = self.ensure_user_board(username)

        column_rows = self.connection.execute(
            """
            SELECT id, title
            FROM columns
            WHERE board_id = ?
            ORDER BY position ASC
            """,
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

    def save_board(self, username: str, board: BoardPayload) -> BoardPayload:
        board_id = self.ensure_user_board(username)
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
                    (
                        card.id,
                        board_id,
                        column.id,
                        card.title,
                        card.details,
                        card_position,
                        now,
                        now,
                    ),
                )

        self.connection.execute(
            "UPDATE boards SET updated_at = ? WHERE id = ?",
            (now, board_id),
        )
        return self.get_board(username)
