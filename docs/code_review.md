# Code Review

Date: 2026-07-15
Scope: full repo (`backend/`, `frontend/`, Docker/scripts, docs). Backend test suite and frontend
unit tests were run and pass; `npm run lint` was run and currently fails (see Finding 1).

## Summary

The codebase is small, matches the layering described in `CLAUDE.md`/`backend/AGENTS.md`, and has
reasonable test coverage on both sides (16 backend tests passing / 2 skipped live-only, 11 frontend
unit tests passing). Three issues are worth fixing before calling this done: a currently-failing lint
rule that also causes a real login-flicker bug, a missing-validation path that lets a client or the AI
crash the board-save endpoint with an unhandled 500, and a per-keystroke autosave that spams the API
and can race itself. The rest are smaller robustness/reproducibility items.

## Findings

| # | Severity | Area | Summary |
|---|----------|------|---------|
| 1 | High | Frontend | `npm run lint` fails; underlying pattern also causes a login-flicker bug in `AuthGate` |
| 2 | High | Backend | Duplicate card-id references in a `BoardPayload` crash `PUT /api/board` and `POST /api/ai/chat` with an unhandled `sqlite3.IntegrityError` (500) instead of a 4xx |
| 3 | Medium | Frontend | Column rename autosaves on every keystroke, with no debounce and no request sequencing |
| 4 | Medium | Build | `backend/uv.lock` exists locally but is untracked in git, and the Dockerfile never copies it into the build — dependency versions are not pinned/reproducible in the image |
| 5 | Low | Backend | SQLite connections have no busy timeout / WAL mode, so concurrent writes (made more likely by Finding 3) can raise an unhandled "database is locked" 500 |
| 6 | Info | Frontend | `AuthGate` is a client-only, hardcoded-credential gate — this is an explicit MVP decision in `AGENTS.md`, not a defect, but is called out here for completeness |

---

### 1. `npm run lint` fails — and the underlying pattern causes a login-flicker bug (High)

`frontend/src/components/AuthGate.tsx:16-19`:

```tsx
useEffect(() => {
  const stored = window.localStorage.getItem(AUTH_KEY);
  setIsAuthenticated(stored === "true");
}, []);
```

Running `npm run lint` today fails:

```
error  Error: Calling setState synchronously within an effect can trigger cascading renders
react-hooks/set-state-in-effect
```

Beyond the lint failure itself, this is a real (if minor) UX bug: `isAuthenticated` initializes to
`false`, so every page load renders the sign-in form first and only flips to the board after the
effect runs post-mount — a visible flicker for an already-authenticated user, and an extra render.

**Action**: initialize state lazily instead of setting it from an effect:

```tsx
const [isAuthenticated, setIsAuthenticated] = useState(
  () => typeof window !== "undefined" && window.localStorage.getItem(AUTH_KEY) === "true"
);
```

This removes the effect entirely, fixes the lint failure, and removes the flicker. (Since this is a
static-exported SPA rendered client-side, `window` is available at first client render; no
hydration-mismatch concern here as there's no server-rendered HTML for this component to mismatch
against.)

### 2. Duplicate card-id references crash board save with a 500 (High)

`backend/app/schemas/board.py:20-30` validates that every card id referenced in a column's `cardIds`
exists in the `cards` dict ("dangling reference" check), but it does not validate that:
- a card id appears in at most one column's `cardIds` (or once within the same column), or
- column ids are unique within `columns`.

`backend/app/repositories/board_repository.py:105-138` (`save_board`) then inserts one row per
`(column, cardIds entry)` and one row per column, both keyed by `id TEXT PRIMARY KEY`
(`backend/app/db/schema.py:53-74`). A payload like:

```json
{"columns": [{"id": "c1", "title": "Todo", "cardIds": ["card-1", "card-1"]}],
 "cards": {"card-1": {"id": "card-1", "title": "x", "details": ""}}}
```

passes `BoardPayload` validation, then raises an unhandled `sqlite3.IntegrityError` inside the
`INSERT INTO cards ...` loop. Neither `board.py`'s route nor `ai.py`'s route catches
`sqlite3.IntegrityError`, so this surfaces as a bare 500 instead of the 4xx the rest of the API
uses for bad input.

This is reachable two ways:
- Directly via `PUT /api/board` with a hand-crafted payload.
- Indirectly via `POST /api/ai/chat` — the AI model's structured `board_update` is only validated
  against `AIChatStructuredOutput` (which reuses the same `BoardPayload`), so a model hallucinating
  the same card into two columns (a plausible failure mode when asking it to "move" a card) will
  crash the save instead of failing gracefully with a message the chat UI can display.

**Action**: add a `model_validator` to `BoardPayload` (alongside the existing dangling-reference
check) that rejects duplicate card-id references across/within `columns` and duplicate column ids,
so these fail as a 422/400 the same way dangling references already do. Add a test mirroring
`test_put_board_rejects_dangling_card_reference` for the duplicate-reference case.

### 3. Column rename autosaves on every keystroke (Medium)

`frontend/src/components/KanbanColumn.tsx:42-47`:

```tsx
<input
  value={column.title}
  onChange={(event) => onRename(column.id, event.target.value)}
  ...
/>
```

`onRename` → `KanbanBoard.handleRenameColumn` → `applyBoardUpdate` → `updateBoard()`
(`frontend/src/components/KanbanBoard.tsx:96-104`, `:67-78`) fires a `PUT /api/board` on **every
keystroke**, with no debounce and no cancellation of in-flight requests
(`frontend/src/lib/api.ts:48-62`). Two consequences:
- Typing a column title of length N fires N full-board PUT requests.
- Because requests aren't sequenced or aborted, a slower earlier request can resolve after a later
  one, persisting a stale title to SQLite even though the UI (and next keystroke's payload) has moved
  on — the visible state and the persisted state can silently diverge until the next edit.

**Action**: debounce the save (e.g., commit on blur, or debounce ~400-500ms after the last keystroke)
the same way `NewCardForm` already defers writes to an explicit submit rather than firing per
keystroke. If per-keystroke local state is wanted for responsiveness, keep that in local component
state and only call `onRename`/`applyBoardUpdate` on blur or via a debounced callback.

### 4. `uv.lock` isn't used for reproducible Docker builds (Medium)

`git status` shows `backend/uv.lock` as untracked (`?? backend/uv.lock`), and nothing in
`.gitignore` excludes it (the UV section in `.gitignore` is commented out, i.e. explicitly not
ignoring it) — it has simply never been committed. Separately, `Dockerfile:13-14`:

```dockerfile
COPY backend/pyproject.toml ./
RUN uv sync --no-dev
```

only copies `pyproject.toml` before running `uv sync`, so even once `uv.lock` is committed, the
Docker build still won't see it at sync time (it's only copied afterward, in the later
`COPY backend/ ./`). Net effect: every Docker build re-resolves dependency versions against
`pyproject.toml`'s loose ranges (e.g. `fastapi>=0.116.0`) instead of a pinned, reproducible set —
which contradicts the "everything packaged into one Docker container" reproducibility goal implied
by `AGENTS.md`.

**Action**:
1. Commit `backend/uv.lock`.
2. In `Dockerfile`, copy it alongside `pyproject.toml` before syncing, and sync from the lock file:
   ```dockerfile
   COPY backend/pyproject.toml backend/uv.lock ./
   RUN uv sync --no-dev --locked
   ```

### 5. No SQLite busy timeout / WAL mode (Low)

`backend/app/db/session.py:14-19` opens a new `sqlite3.connect(path)` per request with default
journal mode and no `busy_timeout`. SQLite's default writer-lock behavior means a second writer that
arrives while another connection holds the write lock fails immediately (or after Python's default
5s `sqlite3` timeout) with `sqlite3.OperationalError: database is locked`, which is unhandled and
surfaces as a 500. This is unlikely to bite today given the single-user MVP scope, but Finding 3
(rapid-fire PUTs while typing) makes overlapping writes from the same browser tab plausible, and it
would also bite if the AI chat save and a manual board save happen to overlap.

**Action** (small, low-risk): in `get_connection`, set `PRAGMA journal_mode=WAL` and a
`busy_timeout` (e.g. `connection.execute("PRAGMA busy_timeout = 5000")`) so concurrent writers queue
briefly instead of failing outright.

### 6. Hardcoded client-side auth (Informational, not a defect)

`AuthGate.tsx` checks credentials against constants baked into the client bundle and stores an
"authenticated" flag in `localStorage`, and `GET/PUT /api/board` accept any `username` unauthenticated.
This is called out explicitly as the intended MVP scope in root `AGENTS.md` ("hardcoded to 'user' and
'password'") and `CLAUDE.md`'s out-of-scope list ("real auth"), so it is not a finding to act on —
noted here only so it's visible in one place as a known, intentional limitation rather than an
oversight.

## Verification performed

- `backend`: `.venv\Scripts\python.exe -m pytest -q` → 16 passed, 2 skipped (live OpenRouter tests,
  gated behind `OPENROUTER_LIVE_TEST_ENABLED`).
- `frontend`: `npm run test:unit` → 3 files, 11 tests, all passing.
- `frontend`: `npm run lint` → **fails** (Finding 1).
- `frontend`: `npm run build` → succeeds (Next's `next build` here doesn't run ESLint, so Finding 1
  does not currently break the Docker image build, only local dev/lint workflows).

## Not flagged

- SQL access throughout `board_repository.py` is fully parameterized — no injection risk.
- The static-file fallback route in `main.py` (`spa_fallback`) correctly resolves and
  contains-checks paths against `STATIC_DIR` before serving, so `../` traversal is blocked.
  `/api/*` is excluded from the fallback and 404s cleanly.
- `.env` is git-ignored and not tracked; no secrets found committed in the repo.
- Card/column titles and details are rendered as plain React children (never
  `dangerouslySetInnerHTML`), so there's no stored-XSS path from AI- or user-authored board content.
