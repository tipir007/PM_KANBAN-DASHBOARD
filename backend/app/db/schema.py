from datetime import UTC, datetime
from sqlite3 import Connection

from app.core.security import hash_password


DEFAULT_USER_ID = "user-1"
DEFAULT_BOARD_ID = "board-1"
DEFAULT_USERNAME = "user"
DEFAULT_PASSWORD = "password"

DEFAULT_COLUMNS = [
    ("col-backlog", "Backlog"),
    ("col-discovery", "Discovery"),
    ("col-progress", "In Progress"),
    ("col-review", "Review"),
    ("col-done", "Done"),
]

DEFAULT_CARDS = [
    ("card-1", "col-backlog", "Align roadmap themes", "Draft quarterly themes with impact statements and metrics."),
    ("card-2", "col-backlog", "Gather customer signals", "Review support tags, sales notes, and churn feedback."),
    ("card-3", "col-discovery", "Prototype analytics view", "Sketch initial dashboard layout and key drill-downs."),
    ("card-4", "col-progress", "Refine status language", "Standardize column labels and tone across the board."),
    ("card-5", "col-progress", "Design card layout", "Add hierarchy and spacing for scanning dense lists."),
    ("card-6", "col-review", "QA micro-interactions", "Verify hover, focus, and loading states."),
    ("card-7", "col-done", "Ship marketing page", "Final copy approved and asset pack delivered."),
    ("card-8", "col-done", "Close onboarding sprint", "Document release notes and share internally."),
]


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def create_schema(connection: Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS boards (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL DEFAULT 'My Board',
            position INTEGER NOT NULL DEFAULT 0,
            metadata_json TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_boards_user
            ON boards(user_id, position);
        CREATE INDEX IF NOT EXISTS idx_sessions_user
            ON sessions(user_id);

        CREATE TABLE IF NOT EXISTS columns (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            position INTEGER NOT NULL,
            metadata_json TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(board_id, position)
        );

        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
            column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            position INTEGER NOT NULL,
            metadata_json TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cards_column_position
            ON cards(column_id, position);
        CREATE INDEX IF NOT EXISTS idx_cards_board
            ON cards(board_id);
        """
    )


def _column_names(connection: Connection, table: str) -> set[str]:
    return {row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}


def migrate_schema(connection: Connection) -> None:
    """Evolve a pre-existing database in place, idempotently.

    Handles installs created before user management / multi-board support:
    adds missing columns and drops the legacy UNIQUE(user_id) on boards that
    limited each user to a single board.
    """
    user_columns = _column_names(connection, "users")
    if "password_hash" not in user_columns:
        connection.execute(
            "ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''"
        )

    board_columns = _column_names(connection, "boards")
    if board_columns and "position" not in board_columns:
        connection.execute(
            "ALTER TABLE boards ADD COLUMN position INTEGER NOT NULL DEFAULT 0"
        )

    # SQLite cannot drop a table-level UNIQUE constraint via ALTER, so detect the
    # legacy constraint in the stored DDL and rebuild the table without it.
    board_ddl_row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'boards'"
    ).fetchone()
    if board_ddl_row and "UNIQUE(user_id)" in board_ddl_row[0].replace(" ", ""):
        connection.executescript(
            """
            PRAGMA foreign_keys = OFF;
            CREATE TABLE boards_new (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL DEFAULT 'My Board',
                position INTEGER NOT NULL DEFAULT 0,
                metadata_json TEXT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO boards_new (id, user_id, name, position, metadata_json, created_at, updated_at)
                SELECT id, user_id, name, position, metadata_json, created_at, updated_at FROM boards;
            DROP TABLE boards;
            ALTER TABLE boards_new RENAME TO boards;
            CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id, position);
            PRAGMA foreign_keys = ON;
            """
        )


def seed_default_data(connection: Connection) -> None:
    has_users = connection.execute("SELECT 1 FROM users LIMIT 1").fetchone()
    if has_users:
        return

    now = _utc_now()
    connection.execute(
        "INSERT INTO users(id, username, password_hash, created_at) VALUES(?, ?, ?, ?)",
        (DEFAULT_USER_ID, DEFAULT_USERNAME, hash_password(DEFAULT_PASSWORD), now),
    )
    connection.execute(
        """
        INSERT INTO boards(id, user_id, name, position, metadata_json, created_at, updated_at)
        VALUES(?, ?, ?, 0, NULL, ?, ?)
        """,
        (DEFAULT_BOARD_ID, DEFAULT_USER_ID, "My Board", now, now),
    )

    for index, (column_id, title) in enumerate(DEFAULT_COLUMNS):
        connection.execute(
            """
            INSERT INTO columns(id, board_id, title, position, metadata_json, created_at, updated_at)
            VALUES(?, ?, ?, ?, NULL, ?, ?)
            """,
            (column_id, DEFAULT_BOARD_ID, title, index, now, now),
        )

    position_by_column: dict[str, int] = {}
    for card_id, column_id, title, details in DEFAULT_CARDS:
        position = position_by_column.get(column_id, 0)
        position_by_column[column_id] = position + 1
        connection.execute(
            """
            INSERT INTO cards(id, board_id, column_id, title, details, position, metadata_json, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, NULL, ?, ?)
            """,
            (card_id, DEFAULT_BOARD_ID, column_id, title, details, position, now, now),
        )
