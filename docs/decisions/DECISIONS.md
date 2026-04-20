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
