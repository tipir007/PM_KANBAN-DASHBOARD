# Code Review

Date: 2026-07-24
Scope: full repo (`backend/`, `frontend/`, Docker/scripts, docs). Backend test suite and frontend
unit tests were run and pass; `npm run lint` passes.

## Summary

The codebase is clean, well-layered, and follows the conventions in `CLAUDE.md`/`backend/AGENTS.md`.
Test coverage is solid: 21 backend tests passing (2 skipped live-only), 12 frontend unit tests
passing. Four of six issues from the previous review (2026-07-15) have been fixed. The remaining
issues are low severity. The code is concise and avoids unnecessary abstraction.

## Previous Review Status

| # | Prev Severity | Area | Status |
|---|---------------|------|--------|
| 1 | High | Frontend | Fixed -- lint passes, AuthGate uses lazy useState |
| 2 | High | Backend | Fixed -- BoardPayload validates duplicate card refs + column IDs |
| 3 | Medium | Frontend | Fixed -- column rename commits on blur/Enter only |
| 4 | Medium | Build | Fixed -- Dockerfile copies uv.lock, uses `--locked` |
| 5 | Low | Backend | Not fixed -- no SQLite WAL/busy_timeout |
| 6 | Info | Frontend | Still present -- intentional MVP hardcoded auth |

## Findings

| # | Severity | Area | Summary |
|---|----------|------|---------|
| 5 | Low | Backend | No SQLite WAL/busy_timeout -- concurrent writes can raise "database is locked" 500 |
| 7 | Low | Backend | `_utc_now()` duplicated in `db/schema.py` and `repositories/board_repository.py` |
| 8 | Low | Frontend | `cardsById` useMemo in `KanbanBoard.tsx:37` is a no-op |
| 9 | Low | Frontend | AIChatSidebar message key uses array index (fragile to reordering) |
| 10 | Info | Backend | `starlette.testclient` deprecation warning in test output |

---

### 5. No SQLite busy timeout / WAL mode (Low, carried from previous review)

`backend/app/db/session.py:14-19` opens a new `sqlite3.connect(path)` per request with default
journal mode and no `busy_timeout`. SQLite's default writer-lock behavior means a second writer
that arrives while another connection holds the write lock fails with
`sqlite3.OperationalError: database is locked`, which is unhandled and surfaces as a 500. This is
unlikely to bite in single-user MVP scope, but overlapping writes from rapid manual saves or
simultaneous AI chat saves are plausible.

**Action** (small, low-risk): in `get_connection`, set `PRAGMA journal_mode=WAL` and
`PRAGMA busy_timeout = 5000` so concurrent writers queue briefly instead of failing outright.

### 7. `_utc_now()` is duplicated (Low)

`backend/app/db/schema.py:28` and `backend/app/repositories/board_repository.py:8` both define
identical `_utc_now()` functions:

```python
def _utc_now() -> str:
    return datetime.now(UTC).isoformat()
```

Two copies can drift if one is updated and the other is not. Both are used for timestamping
database records.

**Action**: extract to a single location (e.g. a small utility in `db/` or a shared constant)
and import from both callers.

### 8. `cardsById` useMemo is a no-op (Low)

`frontend/src/components/KanbanBoard.tsx:37`:

```tsx
const cardsById = useMemo(() => board.cards, [board.cards]);
```

This memo returns its input unchanged when the input reference changes, providing no caching
benefit. It adds indirection without value.

**Action**: remove the useMemo and use `board.cards` directly at the one callsite (`:159`).

### 9. AIChatSidebar message key uses array index (Low)

`frontend/src/components/AIChatSidebar.tsx:83`:

```tsx
key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
```

Using `index` in a React key makes it fragile to list reordering or insertion. The content
slice prefix adds minor instability. For the current MVP (append-only chat, no reordering)
this works, but is not robust.

**Action**: if message IDs are ever added, use them. Otherwise, for now this is acceptable
given the append-only nature of the chat.

### 10. StarletteDeprecationWarning in test output (Info)

Backend test output shows:

```
StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated;
install httpx2 instead.
```

This is a deprecation from the Starlette/FastAPI ecosystem. It does not affect test results
or functionality today but will eventually require updating to `httpx2` when the upstream
packages remove the legacy path.

**Action**: no immediate action needed. Track for a future dependency update.

## Verification performed

- `backend`: `.venv/Scripts/python.exe -m pytest -q` -- 21 passed, 2 skipped (live OpenRouter
  tests, gated behind `OPENROUTER_LIVE_TEST_ENABLED`).
- `frontend`: `npm run lint` -- passes.
- `frontend`: `npm run test:unit` -- 3 files, 12 tests, all passing.
- `frontend`: `npm run build` -- succeeds (static export).

## Not flagged (carried from previous review, still valid)

- SQL access throughout `board_repository.py` is fully parameterized -- no injection risk.
- The static-file fallback route in `web/router.py` correctly contains-checks paths against
  `STATIC_DIR` before serving, so `../` traversal is blocked. `/api/*` is excluded from the
  fallback and 404s cleanly.
- `.env` is git-ignored and not tracked; no secrets found committed in the repo.
- Card/column titles and details are rendered as plain React children (never
  `dangerouslySetInnerHTML`), so there is no stored-XSS path from AI- or user-authored content.
- Board validation in `BoardPayload.validate_references` catches dangling card references,
  duplicate card references, and duplicate column IDs before persistence.
- The delete-and-reinsert strategy in `save_board` is simple and correct for the MVP. It does
  not preserve `created_at` timestamps on cards/columns across saves, which is acceptable for
  the current scope.
- The Docker multi-stage build correctly separates frontend build (Node) from runtime (Python),
  and the web router is registered last to avoid shadowing API routes.
