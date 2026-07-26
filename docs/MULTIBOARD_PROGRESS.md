# Multi-user / Multi-board progress

Tracking the ralph-loop effort to add real user management and multiple kanban boards per user.
This intentionally overrides the original "MVP out of scope" exclusions (multi-board, real auth),
per an explicit user decision on 2026-07-26.

## Target scope

- Real user registration + login (hashed passwords, opaque session tokens).
- Multiple boards per user: list / create / rename / delete / switch.
- AI chat operates on a selected board.
- Strong unit + integration test coverage on both sides; full suite green.

## Plan / checklist

Backend
- [x] Schema: users.password_hash, boards without UNIQUE(user_id) + position, sessions table, migration for existing DBs.
- [x] Password hashing + token generation (stdlib, no new deps).
- [x] Auth repository / service / API (register, login, logout, me).
- [x] Board repository/service/API keyed by board_id: list, create, rename, delete, get, update.
- [x] Ownership isolation (a user cannot touch another user's board -> 404) + cannot delete only board.
- [x] Registration provisions a default "My Board"; new boards seeded with default columns.
- [x] AI chat keyed by board_id (optional board_id on /api/ai/chat; ownership enforced; legacy path kept).
- [x] Backend tests for board management + AI scoping. Suite: 37 passed, 2 skipped.

Frontend
- [x] Real auth (register/login) UI replacing hardcoded AuthGate; token stored in localStorage.
- [x] Board switcher (tabs) + create/rename/delete UI (BoardWorkspace).
- [x] api.ts: auth calls, board-list calls, board-id-scoped calls, Bearer token header, chat with board_id.
- [x] Unit tests (vitest): 18 passed. Lint clean. Production build (static export) compiles.
- [ ] e2e (playwright) spec updated for new login/board UI; still needs a live run to confirm.

## Notes / decisions

- No new backend dependencies: password hashing uses hashlib.pbkdf2_hmac; tokens use secrets.
- Backward compatibility kept where cheap while endpoints migrate to board_id.
