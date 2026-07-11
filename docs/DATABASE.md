# Database Design (MVP)

## Goal

Define a normalized SQLite schema for Kanban persistence that supports:
- one board per user in MVP,
- future multi-user growth,
- optional JSON metadata for flexible, non-core fields.

## Why normalized schema

- Core Kanban entities (`board`, `column`, `card`) are relational by nature.
- Relational tables make reordering, filtering, and targeted updates simpler than full-document rewrites.
- Constraints and indexes provide integrity for ownership and ordering.
- Optional metadata JSON keeps flexibility without moving core fields into unstructured storage.

## Schema (initial proposal)

### `users`

- `id` TEXT PRIMARY KEY
- `username` TEXT NOT NULL UNIQUE
- `created_at` TEXT NOT NULL (ISO timestamp)

Notes:
- MVP uses a single hardcoded account (`user`), but table supports future users.

### `boards`

- `id` TEXT PRIMARY KEY
- `user_id` TEXT NOT NULL REFERENCES `users(id)` ON DELETE CASCADE
- `name` TEXT NOT NULL DEFAULT 'My Board'
- `metadata_json` TEXT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Constraints:
- UNIQUE(`user_id`) for MVP one-board-per-user.

### `columns`

- `id` TEXT PRIMARY KEY
- `board_id` TEXT NOT NULL REFERENCES `boards(id)` ON DELETE CASCADE
- `title` TEXT NOT NULL
- `position` INTEGER NOT NULL
- `metadata_json` TEXT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Indexes/constraints:
- UNIQUE(`board_id`, `position`) to preserve deterministic column order.

### `cards`

- `id` TEXT PRIMARY KEY
- `board_id` TEXT NOT NULL REFERENCES `boards(id)` ON DELETE CASCADE
- `column_id` TEXT NOT NULL REFERENCES `columns(id)` ON DELETE CASCADE
- `title` TEXT NOT NULL
- `details` TEXT NOT NULL DEFAULT ''
- `position` INTEGER NOT NULL
- `metadata_json` TEXT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Indexes/constraints:
- INDEX on (`column_id`, `position`) for ordered fetch per column.
- INDEX on (`board_id`) for board-scoped operations.

## JSON metadata usage policy

- `metadata_json` is optional and for non-core/extensible fields only.
- Keep core query fields relational:
  - names/titles,
  - ownership links,
  - ordering,
  - card body text.
- Avoid storing data in metadata when it needs frequent filtering/sorting.

Examples of allowed metadata later:
- UI-only flags,
- optional color hints,
- temporary migration markers.

## API mapping strategy

For board read:
- Query `boards` by `user_id`.
- Query ordered `columns` by `position`.
- Query ordered `cards` by (`column_id`, `position`).
- Assemble response shape expected by frontend.

For board update:
- Validate payload first.
- Apply update in a transaction:
  - update renamed columns,
  - upsert/move/reorder cards,
  - delete removed cards.
- Update parent `boards.updated_at`.

## Bootstrap strategy

- On startup, create DB file if absent.
- Create tables/indexes idempotently.
- Seed MVP user and one default board+columns only when database is empty.

## Test implications

Minimum backend tests tied to this schema:
- Schema bootstrap creates all tables and indexes.
- One board per user uniqueness is enforced.
- Column/card order persistence works across read/write cycles.
- Cascading delete works for board -> columns/cards.

## MVP boundaries

Included:
- single hardcoded login identity mapped to a `users` row,
- one board per user constraint,
- normalized tables with optional metadata JSON.

Deferred (non-MVP):
- multi-board per user,
- sharing/permissions,
- audit history/versioning,
- full-text search.
