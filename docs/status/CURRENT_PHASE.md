# Current Phase

## Active phase

Phase: BUILD-P1 - First value for a new player

## Goal

Make a new user enter the Mini App, get first value in under one minute, understand their role, and see that progress still exists after reopening.

This phase builds on top of the existing Telegram Mini App shell. Server-side Telegram `initData` validation stays intact, while the first personal game loop becomes real and persistent.

## In scope

- Keep the existing Telegram auth/JWT shell and trust boundary.
- Create or load a persistent user/profile on auth.
- Add archetype selection for `botan`, `sportsman`, and `partygoer`.
- Add one energy resource and one soft currency.
- Add the first 4 short actions with readable rewards.
- Add profile level, archetype progress, and a basic home screen.
- Create `packages/contracts` for shared product-facing API contracts.
- Add Prisma/PostgreSQL persistence and migration files for BUILD-P1 state.

## Out of scope

- Async shared world.
- Parties.
- Exam event.
- Complex inventory.
- PvP.
- Daily/weekly quest systems.
- TanStack Query.
- `packages/game-core`.

## Required user-visible result

A new player can:

- enter through Telegram auth;
- choose one of three archetypes;
- perform at least one meaningful action;
- see profile XP, archetype XP, energy, and soft currency update;
- reopen the Mini App and see the same saved profile state.

## Mandatory checks for this phase

- `pnpm install`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- local PostgreSQL is reachable through `DATABASE_URL`
- `pnpm --filter @sharaga/api prisma:migrate:deploy` applies BUILD-P1 schema
- manual smoke covers auth -> profile -> archetype select -> action -> reload with valid Telegram dev initData

## Done when

- BUILD-P1 endpoints and frontend flow work without bypassing Telegram server validation.
- Saved progress is backed by persistent storage rather than in-memory API state.
- `packages/contracts` is the shared source for BUILD-P1 enums and DTOs.
- Docs and commands reflect the new DB/runtime requirements.
- Known blockers are written below instead of hidden in chat history.

## Known gaps

- `apps/web` still uses a placeholder `node --test` script; no UI automation exists yet.
- `packages/game-core`, async world systems, and party/event mechanics are intentionally not started in BUILD-P1.

## Last verification

2026-04-21 BUILD-P1:

- `pnpm install` passed.
- `pnpm check` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `packages/contracts` now contains BUILD-P1 action/archetype enums and API schemas.
- `apps/api` now includes Prisma schema, checked-in migration, persistent profile/auth flow, and `/api/v1/profile`, `/api/v1/class/select`, `/api/v1/actions/perform`.
- `apps/web` now boots into archetype selection or the saved home screen and shows readable action rewards.
- After Docker was installed, `docker compose up -d db` passed and local PostgreSQL accepted connections on `127.0.0.1:5432`.
- `pnpm --filter @sharaga/api prisma:migrate:deploy` passed against the local PostgreSQL instance.
- Manual smoke passed with local dev env: `/api/v1/health` returned `ok`, auth worked both directly against `http://127.0.0.1:3001/api/v1/auth/telegram` and through the Vite proxy at `http://localhost:3000/api/v1/auth/telegram`, `/api/v1/profile` showed a fresh player with no archetype, `/api/v1/class/select` saved `botan`, `/api/v1/actions/perform` granted readable rewards, and repeated auth plus `/api/v1/profile` returned the same persisted state.

## Next phase

CHECK-C1 - First Value Control

Run only after BUILD-P1 manual smoke is completed in an environment with PostgreSQL access.
