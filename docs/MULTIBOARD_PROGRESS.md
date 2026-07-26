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
- [ ] AI chat keyed by board_id.
- [x] Backend tests for board management (test_boards.py). Suite: 35 passed, 2 skipped.

Frontend
- [ ] Real auth (register/login) UI replacing hardcoded AuthGate; store token.
- [ ] Board switcher + create/rename/delete UI.
- [ ] api.ts: auth calls, board-list calls, board-id-scoped calls, token header.
- [ ] Unit + e2e tests.

## Notes / decisions

- No new backend dependencies: password hashing uses hashlib.pbkdf2_hmac; tokens use secrets.
- Backward compatibility kept where cheap while endpoints migrate to board_id.
