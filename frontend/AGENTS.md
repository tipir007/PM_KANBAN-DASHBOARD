# Frontend Guide

This document describes the existing frontend and conventions for future frontend work.

## Current frontend snapshot

- Framework: Next.js App Router (`src/app`).
- Language: TypeScript + React.
- Styling: global CSS in `src/app/globals.css`.
- Core feature: Kanban board with drag/drop and card editing UI.
- Main modules:
  - `src/app/page.tsx` - entry page.
  - `src/components/` - board, column, card, and form UI components.
  - `src/lib/kanban.ts` - Kanban helpers/state utilities.
- Existing tests:
  - Unit/component tests with Vitest + Testing Library.
  - E2E coverage with Playwright.

## Target frontend structure

Keep and extend current organization:

- `src/app/` - routes, layout, app-level UI shells.
- `src/components/` - presentational and interactive components.
- `src/lib/` - pure utility/domain functions.
- `src/test/` - test setup helpers/types.
- `tests/` - Playwright E2E tests.

If adding backend integration, keep API client helpers in `src/lib/` (for example `api.ts`) rather than embedding fetch logic across components.

## UI and state conventions

- Keep components focused and small.
- Prefer local state for local concerns; lift state only when multiple components need the same source of truth.
- Keep board state shape explicit and centralized in lib/types helpers.
- Preserve current drag/drop behavior while introducing persistence.
- Use project color scheme from root `AGENTS.md` for new UI elements.

## API integration conventions

- Backend API base path should be `/api`.
- Use typed request/response contracts in frontend code.
- Centralize network calls in helper functions (`src/lib`), not inline in JSX event handlers.
- Handle three states in UI where relevant:
  - loading
  - success
  - failure with user-friendly message

## Testing strategy

Use case-by-case scope, aligned with risk:

- Unit tests for helpers (`src/lib`).
- Component tests for form interactions and rendering behavior.
- Integration-style component tests for board workflows.
- Playwright E2E for critical user journeys:
  - login/logout flow
  - board persistence roundtrip
  - AI chat interaction and board refresh (later parts)

Minimum expectation per new frontend feature:
- One happy-path test.
- One meaningful failure/edge test.

## Implementation rules

- Keep implementation simple and MVP-focused.
- Do not add non-MVP features unless explicitly requested.
- Avoid speculative abstractions; refactor only when repetition is proven.
- Keep comments minimal and only where behavior is not obvious.
