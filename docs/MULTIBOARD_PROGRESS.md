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
- [ ] Board repository/service/API keyed by board_id: list, create, rename, delete, get, update.
- [ ] AI chat keyed by board_id.
- [ ] Backend tests for all of the above.

Frontend
- [ ] Real auth (register/login) UI replacing hardcoded AuthGate; store token.
- [ ] Board switcher + create/rename/delete UI.
- [ ] api.ts: auth calls, board-list calls, board-id-scoped calls, token header.
- [ ] Unit + e2e tests.

## Notes / decisions

- No new backend dependencies: password hashing uses hashlib.pbkdf2_hmac; tokens use secrets.
- Backward compatibility kept where cheap while endpoints migrate to board_id.
