# Decisions

Record decisions that should survive chat history. Keep entries short and factual.

## 2026-04-20 - Preserve Telegram Mini App shell

Decision: build product features on top of the existing Telegram Mini App infrastructure.

Rationale:

- server-side Telegram `initData` validation is already implemented and tested;
- API proxy/deployment shape is already present;
- replacing auth with frontend-only trust would weaken the product foundation.

Consequences:

- product endpoints extend the existing `/api/v1` API;
- frontend reads Telegram data but does not trust it as authentication;
- local dev uses generated valid init data.

## 2026-04-20 - Use phased AI-first workflow

Decision: manage development through BUILD/CHECK phases instead of one broad MVP task.

Rationale:

- AI agents handle bounded vertical slices more reliably;
- each phase has a working product result and self-check contract;
- this reduces half-built systems across the repo.

Consequences:

- `docs/status/CURRENT_PHASE.md` is the active scope source;
- `docs/roadmap/ROADMAP.md` stores the full path;
- control prompts verify previous promises before moving forward.

## 2026-04-20 - Target stack

Decision: default stack is pnpm workspaces, React + TypeScript + Vite, Fastify, REST/JSON, Zod contracts, PostgreSQL, Prisma, Neon, Vitest, and Playwright.

Rationale:

- current repo already uses pnpm, React, Vite, Fastify, and TypeScript;
- Zod contracts keep API boundaries explicit;
- Prisma/PostgreSQL/Neon fit event, party, reputation, and seed workflows;
- Vitest/Playwright give clear agent-verifiable signals.

Consequences:

- add target dependencies only when a phase needs them;
- document rationale for each new dependency;
- avoid introducing tRPC or alternate backend frameworks without a new decision.

## 2026-04-20 - Domain logic should move to shared packages when reused

Decision: create `packages/game-core` and `packages/contracts` when product logic requires shared formulas or API schemas.

Rationale:

- game formulas and event rules need deterministic tests;
- contracts prevent frontend/backend drift;
- empty packages add noise before they have a job.

Consequences:

- BUILD-P1 may keep simple logic in API while it is tiny;
- promote logic to packages when reuse or testing pressure appears.

## 2026-04-21 - Persist BUILD-P1 player state with PostgreSQL and Prisma

Decision: BUILD-P1 stores user/profile/action state in PostgreSQL through Prisma instead of keeping player state in API memory.

Rationale:

- the phase contract requires saved progress after reload and repeated login;
- `apps/api` local instructions explicitly forbid promising persistence through in-memory state;
- Prisma migrations give an explicit schema/update path instead of hidden storage changes.

Consequences:

- `DATABASE_URL` is required for API runtime;
- `apps/api/prisma` owns the BUILD-P1 schema and migration files;
- local and deployment runbooks must include DB setup and migration steps.

## 2026-04-22 - BUILD-P2 async social data model and idempotency

Decision: store campus projects, contributions, benefit claims, and likes as first-class tables; use client-supplied `requestId` + DB unique constraints as the idempotency layer; build the global feed from `ProfileEvent` rows instead of a separate materialized table; keep domain formulas in `apps/api/src/social.ts` until a second consumer exists.

Rationale:

- Client `requestId` (UUID per button press, retained on retry) plus `@@unique([userId, requestId])` prevents double-grant on network retry without requiring a distributed lock.
- DB-level unique constraints on `BenefitClaim(projectId, userId, unlockCycle)` and `ContributionLike(contributionId, fromUserId)` are the authoritative idempotency guards — application logic catches Prisma P2002 and maps to 409.
- Re-using `ProfileEvent` for the feed avoids dual-write (one write = one source of truth for both event log and feed). A keyset index on `createdAt` and a batched project/user lookup keep feed queries to 3 round-trips regardless of page size.
- Project progress is updated via a CAS (compare-and-swap) loop inside a Prisma transaction, bounded at 5 retries. Exactly one CAS winner crosses the threshold, so unlock side-effects (project_unlocked event + per-contributor reputation bumps) happen atomically exactly once.
- `social.ts` stays inside `apps/api` because BUILD-P2 is the only consumer. Promote to `packages/game-core` in BUILD-P3 if season math becomes a second consumer.

Consequences:

- `apps/api/prisma` gains four new models: `Project`, `Contribution`, `BenefitClaim`, `ContributionLike`.
- `Profile` gains a `reputation` field.
- `ProfileEventType` enum gains five new values.
- Seed script (`apps/api/prisma/seed.ts`) provisions the three campus projects idempotently.
- API adds five endpoints under `/api/v1/projects`, `/api/v1/contributions`, `/api/v1/feed`.
- Web gains Projects and Feed tabs; `main.tsx` splits into feature folders.

## 2026-04-21 - Create packages/contracts for BUILD-P1 shared API schemas

Decision: introduce `packages/contracts` in BUILD-P1 as the shared source for archetypes, actions, and profile/action DTOs.

Rationale:

- BUILD-P1 adds real product-facing API contracts used by both API and web;
- shared schemas reduce drift between backend and frontend during the first product slice;
- the package now has a concrete job, so it is no longer empty abstraction theater.

Consequences:

- `apps/api` and `apps/web` both depend on `@sharaga/contracts`;
- Docker build context must include `packages/`;
- `packages/game-core` remains postponed until formulas are reused enough to justify extraction.
