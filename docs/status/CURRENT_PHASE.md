# Current Phase

## Active phase

Phase: CHECK-C1 - First Value Control

## Goal

Verify cumulatively that BUILD-P0 and BUILD-P1 already deliver the promised first player loop without manual explanations.

This control phase confirms the Telegram Mini App shell, persistent profile flow, archetype choice, first meaningful action, and saved progress honestly work together before any BUILD-P2 work starts.

## In scope

- Verify Telegram auth still works through server-side `initData` validation.
- Verify a new user profile is created or loaded persistently on auth.
- Verify archetype choice is meaningful, obvious, and saved.
- Verify at least one short action gives readable first progress.
- Verify progress survives reload and repeated login.
- Fix only missing pieces required to satisfy BUILD-P0 and BUILD-P1 contracts.

## Out of scope

- Async shared world.
- Parties.
- Exam event.
- New currencies, inventory, or PvP.
- Daily/weekly systems beyond what BUILD-P1 already promised.
- New platform layers or phase-advancing abstractions.

## Required user-visible result

A new player can:

- enter through Telegram auth;
- choose one of three archetypes;
- perform at least one meaningful action;
- see profile XP, archetype XP, energy, and soft currency update;
- reopen the Mini App and see the same saved profile state.
- follow the first path without needing manual explanation from the team.

## Mandatory checks for this phase

- `pnpm install`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- local PostgreSQL is reachable through `DATABASE_URL`
- `pnpm --filter @sharaga/api prisma:migrate:deploy` applies BUILD-P1 schema
- manual smoke covers auth -> profile -> archetype select -> action -> reload with valid Telegram dev initData

## Done when

- BUILD-P0 and BUILD-P1 promises are confirmed together instead of assumed from partial tests.
- First login, archetype select, first action, reload, and repeated login all work without bypassing Telegram server validation.
- Any fixes made stay inside BUILD-P1 scope and do not start BUILD-P2 systems.
- Docs reflect the actual verified phase state and any known blocker is written below instead of hidden in chat history.

## Known gaps

- `apps/web` still uses a placeholder `node --test` script; no UI automation exists yet.
- CHECK-C1 still relies on command-level/API smoke plus manual UX review; browser automation is still a later-phase concern.

## Last verification

2026-04-21 CHECK-C1:

- `pnpm install` passed.
- `pnpm check` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `pnpm --filter @sharaga/api prisma:migrate:deploy` passed against local PostgreSQL at `127.0.0.1:5432`.
- Real HTTP smoke passed against the built API with Prisma/PostgreSQL persistence: `/api/v1/health` returned `ok`, a fresh Telegram dev user authenticated successfully, `/api/v1/profile` started with no archetype, `/api/v1/class/select` saved `botan`, `/api/v1/actions/perform` granted readable first rewards, and both reload plus repeated `/api/v1/auth/telegram` returned the same persisted profile state.
- API regression coverage now includes a cumulative first-value loop test for auth -> role select -> action -> reload -> repeated login.
- No CHECK-C1 blocker was found that required scope growth beyond BUILD-P1.

## Next phase

BUILD-P2 - Async social world

Start only with a direct request after accepting CHECK-C1 as complete.
