# High level steps for project

Part 1: Plan

Enrich this document to plan out each of these parts in detail, with substeps listed out as a checklist to be checked off by the agent, and with tests and success critieria for each. Also create an AGENTS.md file inside the frontend directory that describes the existing code there. Ensure the user checks and approves the plan.

Part 2: Scaffolding

Set up the Docker infrastructure, the backend in backend/ with FastAPI, and write the start and stop scripts in the scripts/ directory. This should serve example static HTML to confirm that a 'hello world' example works running locally and also make an API call.

Part 3: Add in Frontend

Now update so that the frontend is statically built and served, so that the app has the demo Kanban board displayed at /. Comprehensive unit and integration tests.

Part 4: Add in a fake user sign in experience

Now update so that on first hitting /, you need to log in with dummy credentials ("user", "password") in order to see the Kanban, and you can log out. Comprehensive tests.

Part 5: Database modeling

Now propose a database schema for the Kanban, saving it as JSON. Document the database approach in docs/ and get user sign off.

Part 6: Backend

Now add API routes to allow the backend to read and change the Kanban for a given user; test this thoroughly with backend unit tests. The database should be created if it doesn't exist.

Part 7: Frontend + Backend

Now have the frontend actually use the backend API, so that the app is a proper persistent Kanban board. Test very throughly.

Part 8: AI connectivity

Now allow the backend to make an AI call via OpenRouter. Test connectivity with a simple "2+2" test and ensure the AI call is working.

Part 9: Now extend the backend call so that it always calls the AI with the JSON of the Kanban board, plus the user's question (and conversation history). The AI should respond with Structured Outputs that includes the response to the user and optionaly an update to the Kanban. Test thoroughly.

Part 10: Now add a beautiful sidebar widget to the UI supporting full AI chat, and allowing the LLM (as it determines) to update the Kanban based on its Structured Outputs. If the AI updates the Kanban, then the UI should refresh automatically.

## Detailed Execution Plan

This section keeps the original 10-part outline and adds concrete execution details, batching guidance, test scope, and success criteria.

### Working sequence and batching

- Locked decisions from planning review:
  - Database model: normalized SQLite tables for users/boards/columns/cards, with optional JSON metadata fields where useful.
  - AI testing: CI uses mocked OpenRouter responses by default; live OpenRouter connectivity test is supported as an explicit/manual run.
- Approval gates:
  - Gate A: approve this plan and AGENTS docs before coding.
  - Gate B: approve database model docs before backend API implementation (after Part 5).
  - Gate C: final acceptance after end-to-end AI + UI flow (after Part 10).
- Practical batching (while preserving intent of parts):
  - Batch 1: Parts 2 + 3 (scaffolding and serving built frontend).
  - Batch 2: Parts 4 + 5 (auth UX and database model docs).
  - Batch 3: Parts 6 + 7 (backend API and frontend integration).
  - Batch 4: Parts 8 + 9 + 10 (AI connectivity, structured output workflow, chat sidebar UX).
- Verification cadence:
  - Run only tests relevant to the changed surfaces while developing.
  - Run full project validation at the end of each batch.

### MVP out of scope (explicitly excluded)

- Real authentication systems (OAuth, JWT, password hashing, registration, password reset).
- Multi-board support per user and advanced workspace/team management.
- Real-time multi-user sync, websockets, and optimistic concurrency control.
- Background workers, task queues, and streaming token UX for LLM responses.
- Role/permission systems beyond single hardcoded login for MVP.
- Cloud deployment/IaC, production hardening, and observability stacks.
- Complex card metadata (attachments, comments, due dates, labels, subtasks, audit logs).
- Internationalization, accessibility overhaul beyond reasonable defaults, and design system expansion.

### Part-by-part checklist, tests, and success criteria

#### Part 1: Plan

Checklist
- [ ] Keep this original 10-part outline intact.
- [ ] Add a detailed plan section with substeps, test scope, and success criteria.
- [ ] Add concrete `backend/AGENTS.md`.
- [ ] Add concrete `frontend/AGENTS.md`.
- [ ] Get explicit user approval before coding.

Tests
- Documentation review only (no code execution required).

Success criteria
- Plan is concrete, ordered, and approved.
- AGENTS docs are specific enough to guide implementation decisions.

#### Part 2: Scaffolding

Checklist
- [ ] Create backend FastAPI scaffold in `backend/`.
- [ ] Add Dockerfile and compose config for local containerized run.
- [ ] Add cross-platform start/stop scripts in `scripts/`.
- [ ] Serve simple backend HTML/API smoke endpoint to validate container and app wiring.

Tests
- Smoke: container builds and starts successfully.
- Smoke: `/` returns scaffold page or configured static root.
- Smoke: API health endpoint returns success.

Success criteria
- One command path exists to start and stop locally.
- Backend starts inside Docker and responds on expected port.

#### Part 3: Add in Frontend

Checklist
- [ ] Build NextJS frontend as static assets.
- [ ] Configure FastAPI to serve built frontend at `/`.
- [ ] Ensure Kanban demo renders through backend-hosted root route.

Tests
- Frontend unit tests (`vitest`).
- Frontend integration/e2e smoke (`playwright`) for board render.
- Backend route smoke for static asset serving and client routing behavior.

Success criteria
- Visiting `/` shows the existing Kanban demo via backend server.
- Static assets load correctly from containerized environment.

#### Part 4: Fake sign-in UX

Checklist
- [ ] Add login screen flow on first visit.
- [ ] Enforce hardcoded credentials (`user` / `password`).
- [ ] Add logout capability.
- [ ] Guard Kanban route/view behind signed-in state.

Tests
- Frontend unit tests for login form behavior and guard logic.
- Integration/e2e test for valid login, invalid login, and logout.

Success criteria
- User cannot access Kanban UI without successful login.
- Logout returns user to login state reliably.

#### Part 5: Database modeling

Checklist
- [ ] Propose SQLite schema supporting multi-user future and one-board-per-user MVP.
- [ ] Define normalized schema for boards, columns, and cards.
- [ ] Define optional JSON metadata fields (only where needed).
- [ ] Add database design doc under `docs/` with rationale and migration approach.
- [ ] Obtain user sign-off before implementing data layer/API details.

Tests
- Design validation only:
  - Schema supports required CRUD operations.
  - Constraints/indexes are sufficient for MVP usage.

Success criteria
- Normalized schema and optional metadata strategy are documented and approved.
- Clear mapping exists between API payloads and relational persistence format.

#### Part 6: Backend API

Checklist
- [ ] Implement board read/write routes scoped by user.
- [ ] Create DB automatically if missing.
- [ ] Add service/repository logic for board persistence.
- [ ] Add consistent API error responses and validation.

Tests
- Backend unit tests for service and repository logic.
- Backend API tests for success and failure cases.
- DB bootstrap test (fresh environment creates DB and tables).

Success criteria
- API can read and update board data for a given user.
- Error cases return stable, documented response shapes.

#### Part 7: Frontend + Backend integration

Checklist
- [ ] Replace local demo-only state with backend-backed data fetch/update.
- [ ] Keep drag/drop and card edit UX functional with persistence.
- [ ] Handle loading and basic API error states in UI.

Tests
- Frontend integration tests for fetch, update, and refresh flows.
- E2E test proving data persists across reload.
- Contract checks between frontend payloads and backend responses.

Success criteria
- Board operations persist via backend and survive page reload.
- Existing Kanban interactions remain intact.

#### Part 8: AI connectivity

Checklist
- [ ] Add backend OpenRouter client integration.
- [ ] Read `OPENROUTER_API_KEY` from project `.env`.
- [ ] Configure model `openai/gpt-oss-120b`.
- [ ] Provide simple backend test route/function for connectivity check.

Tests
- CI integration test using a controlled prompt (`2+2`) with mocked OpenRouter client responses.
- Optional/manual live connectivity test using real OpenRouter call.
- Error-path test for missing/invalid API key handling.

Success criteria
- Backend can successfully call OpenRouter with configured model.
- Failures are surfaced with actionable backend errors.

#### Part 9: Structured AI board operations

Checklist
- [ ] Send board JSON + user question + conversation history to LLM.
- [ ] Require structured response containing assistant text and optional board patch/update payload.
- [ ] Validate and sanitize AI structured output before persistence.
- [ ] Apply valid board updates atomically.

Tests
- Unit tests for structured-output parser/validator.
- Integration tests for:
  - Response-only (no board update).
  - Valid board update path.
  - Invalid structured output rejection.

Success criteria
- AI responses are consistently parseable and safe to apply.
- Optional board updates are reliable and persisted.

#### Part 10: Sidebar AI chat UX

Checklist
- [ ] Add sidebar chat UI connected to backend AI endpoint.
- [ ] Display conversation history and responses.
- [ ] When AI returns board updates, refresh board state automatically.
- [ ] Keep UX aligned with project color scheme.

Tests
- Frontend component tests for chat interactions and rendering.
- E2E flow: ask AI -> receive response -> board auto-refresh on update.
- Regression tests for core Kanban interactions after sidebar integration.

Success criteria
- Chat sidebar works end-to-end with backend AI.
- AI-driven board updates are reflected in UI without manual reload.

### Global quality bar across all parts

- Keep implementations intentionally simple; avoid speculative abstractions.
- Every bug fix/change should trace to a verified root cause.
- Keep docs concise but sufficient for maintenance.
- Do not introduce non-MVP features listed as out-of-scope.