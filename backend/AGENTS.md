# Backend Guide

This document defines concrete conventions for backend implementation in this project.

## Purpose

The backend is a FastAPI service that:
- Serves the built frontend at `/`.
- Exposes API endpoints for authentication (MVP fake login), Kanban persistence, and AI operations.
- Persists data in local SQLite, creating the database automatically if missing.

## Target folder structure

Use this structure as backend is implemented:

- `backend/app/main.py` - FastAPI app creation and router registration only.
- `backend/app/api/` - HTTP route modules (group by feature), all prefixed `/api`.
- `backend/app/web/` - non-API routes: serving the static frontend build and the SPA fallback.
- `backend/app/schemas/` - Pydantic request/response models.
- `backend/app/services/` - business logic orchestration (auth, board, AI workflows).
- `backend/app/repositories/` - database read/write logic.
- `backend/app/db/` - engine/session setup, schema bootstrap helpers.
- `backend/tests/` - backend tests (unit + API/integration).

Keep naming simple and explicit (`board_service.py`, `board_repository.py`, etc.).

## API style conventions

- Prefix API routes with `/api`.
- Use resource-focused endpoints with simple verbs:
  - `GET /api/board`
  - `PUT /api/board`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/ai/chat`
- Return JSON for all API routes.
- Keep response shapes stable and documented through Pydantic schemas.
- Validate request payloads with Pydantic; reject invalid payloads with clear 4xx errors.
- Avoid hidden side effects in read endpoints.

## Error handling conventions

- Use FastAPI `HTTPException` for expected client/server error cases.
- Keep error payloads consistent:
  - `detail`: short, human-readable message.
  - Optional `code`: stable machine-friendly error identifier when needed.
- Typical status code usage:
  - `400` for invalid request semantics.
  - `401` for auth failures in MVP login.
  - `404` for missing resources.
  - `422` for validation failures (framework default is acceptable).
  - `500` only for unexpected failures.
- Log server-side failures with enough context to debug root cause (without leaking secrets).

## Database conventions

- Use SQLite for MVP local persistence.
- Keep one board per user for MVP, but model tables with user ownership for future multi-user support.
- Prefer normalized relational tables for boards, columns, and cards.
- Use optional JSON metadata columns only for flexible, non-core fields when justified.
- Ensure bootstrap creates DB/tables automatically if absent.
- Keep repository methods narrow and testable (single responsibility per method).

## Environment variable conventions

- Read configuration from environment variables, with `.env` support in local development.
- Required:
  - `OPENROUTER_API_KEY` for AI calls.
- Optional defaults should be explicit in code (for example host/port/db path).
- Never hardcode secrets in source files or tests.

## Testing strategy

Use pragmatic, case-by-case test scope:

- Unit tests (`backend/tests/unit/`):
  - service logic
  - repository behavior with controlled fixtures
  - parser/validator logic for AI structured responses
- API tests (`backend/tests/api/`):
  - success and failure responses
  - request validation behavior
  - auth guard behavior for protected routes
- Integration smoke:
  - app boots cleanly
  - DB bootstrap works from empty state
  - static frontend serving route works when assets are present
- AI integration testing policy:
  - CI path uses mocked OpenRouter responses by default.
  - Live OpenRouter connectivity test is optional/manual, not required for default CI pass.

Minimum expectation per new backend feature:
- One success-path test.
- One meaningful failure-path test.

## Implementation rules

- Keep code simple and direct; avoid over-engineering.
- Prove root cause before applying fixes.
- Favor small modules and clear boundaries over deep abstractions.
- Keep comments sparse and only where logic is non-obvious.