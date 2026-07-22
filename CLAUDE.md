# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Project Management MVP: a single-user Kanban board with drag/drop, card editing, and an AI chat sidebar
(via OpenRouter) that can read and modify the board through structured outputs. Next.js frontend, FastAPI
backend, SQLite database, everything packaged into one Docker container where FastAPI serves the statically
exported Next.js build at `/`.

Full requirements and locked decisions: `AGENTS.md` (root). Execution history and per-part checklists:
`docs/PLAN.md`. Database schema rationale: `docs/DATABASE.md`. All 10 planned parts are complete.

## Commands

### Run the full app (Docker — the actual deployment target)

```bash
scripts/start.sh   # or start.bat / start.ps1 — docker compose up --build -d, serves http://localhost:8000
scripts/stop.sh    # or stop.bat / stop.ps1 — docker compose down
```

### Backend (`backend/`, uses `uv`)

```bash
uv sync                          # install deps (uv sync --no-dev for prod-only, as Dockerfile does)
uv run uvicorn app.main:app --reload --port 8000
uv run pytest                    # all tests
uv run pytest tests/test_app.py -k test_name   # single test
```

Live OpenRouter integration tests are gated behind `OPENROUTER_LIVE_TEST_ENABLED=true` and are not part of
the default test run.

### Frontend (`frontend/`)

```bash
npm install
npm run dev            # dev server
npm run build           # static export (used by Docker build, outputs to frontend/out)
npm run lint
npm run test:unit       # vitest run
npm run test:unit:watch
npm run test:e2e        # playwright (playwright.config.ts targets dev server; playwright.docker.config.ts targets localhost:8000)
npm run test:all        # unit + e2e
```

Run a single vitest file: `npx vitest run src/components/KanbanBoard.test.tsx`.
Run a single playwright test: `npx playwright test tests/kanban.spec.ts -g "test name"`.

## Architecture

### Request flow

FastAPI (`backend/app/main.py`) mounts API routers under `/api`, plus `app/web/router.py` (registered last,
so its catch-all route can't shadow `/api/*`) which serves the Next.js static export (`backend/static/`,
copied from `frontend/out` at Docker build time) for every other route, falling back to client-side routing
for unknown non-API paths. Unknown `/api/*` routes always 404 — they never fall back to the SPA HTML.

### Backend layering (`backend/app/`)

Strict layering, enforced by convention (see `backend/AGENTS.md` for full conventions):

- `api/` — route modules only (`board.py`, `ai.py`, `health.py`), prefixed `/api`, thin — delegate to services.
- `services/` — business logic (`board_service.py`, `ai_service.py`). `AIService.chat()` builds the OpenRouter
  request, injecting the full board JSON + conversation history + user question, and requests a strict
  `json_schema` structured response shaped like `AIChatStructuredOutput` (schemas/ai.py).
- `repositories/` — DB read/write only (`board_repository.py`).
- `schemas/` — Pydantic request/response contracts (`board.py`, `ai.py`).
- `db/` — `bootstrap.py` (creates DB/tables/seed data on startup if absent, called from `main.py` lifespan),
  `schema.py`, `session.py`.
- `core/config.py` — `Settings` (pydantic-settings), reads `.env` from the project root (not `backend/`).
- `web/` — non-API routes: `router.py` (`/` and the SPA-fallback catch-all, including the static-path
  traversal check `resolve_static_file`), `fallback.py` (`FALLBACK_HTML`, served when `backend/static/`
  hasn't been built yet).

Config note: `settings.db_path` defaults to `backend/data/pm.db`; `settings.static_dir` defaults to
`backend/static`. Both are relative to `BACKEND_ROOT`, computed from `config.py`'s own path — don't hardcode
these paths elsewhere.

### AI structured-update flow

`POST /api/ai/chat` sends the current board (from `board_repository`) plus the user's question and
conversation history to OpenRouter (`openai/gpt-oss-120b`), forcing a structured JSON response containing
`response` (text) and an optional `board_update` (a full `BoardPayload`). If present, `board_update` is
validated and persisted the same way `PUT /api/board` persists a board. The frontend (`AIChatSidebar.tsx`)
re-fetches the board when a chat response includes an update, so the Kanban view refreshes automatically —
there is no push/streaming channel.

### Database (SQLite, see `docs/DATABASE.md`)

Normalized tables: `users` → `boards` (UNIQUE `user_id`, one board per user for MVP) → `columns` (UNIQUE
`board_id, position`) → `cards` (indexed on `column_id, position` and `board_id`). Optional `metadata_json`
columns exist on boards/columns/cards for non-core extensible fields only — core queryable fields (titles,
ownership, ordering, card body) always stay relational, never in JSON. Bootstrap creates tables and seeds the
MVP user + default board idempotently on startup from an empty DB.

### Frontend (`frontend/src/`, Next.js App Router, static export)

- `app/page.tsx` — entry point, composes `AuthGate` → `KanbanBoard` + `AIChatSidebar`.
- `components/` — `AuthGate` (hardcoded `user`/`password` login gate, no real auth), `KanbanBoard` /
  `KanbanColumn` / `KanbanCard` / `KanbanCardPreview` / `NewCardForm` (dnd-kit based board), `AIChatSidebar`
  (chat UI, calls `chatWithAI` then triggers a board refetch on `board_update`).
- `lib/kanban.ts` — board state types/helpers (pure functions, unit-tested in `kanban.test.ts`).
- `lib/api.ts` — the only place that talks to `/api/*`; all network calls go through `fetchBoard`,
  `updateBoard`, `chatWithAI` here, never inline `fetch` in components.

Drag/drop note (locked decision): dnd-kit sometimes reports `over = null` mid-drag; the board preserves the
last valid drag-over target and falls back to it on drop rather than dropping the card.

## Project-wide conventions

These apply everywhere, not just one side of the stack (see root `AGENTS.md` for the full source):

- Keep it simple — no speculative abstractions, no defensive programming for cases that can't happen, no
  non-MVP features (see `docs/PLAN.md` "MVP out of scope" for the explicit exclusion list: multi-board,
  real auth, websockets/streaming, RBAC, cloud deploy, card attachments/comments/labels, etc.).
  Also: never do this even if it seems like the safe move.
- When debugging, identify root cause before fixing — no guess-and-check.
- No emojis, anywhere (code, docs, commit messages).
- Color scheme for any new UI (`AGENTS.md` root): Accent Yellow `#ecad0a`, Blue Primary `#209dd7`, Purple
  Secondary `#753991`, Dark Navy `#032147`, Gray Text `#888888`.
- Minimum test bar per new feature, either side: one success-path test, one meaningful failure-path test.
