# Current Phase

## Active phase

Phase: BUILD-P4 - Alpha Candidate

## Goal

Harden the existing BUILD-P1, BUILD-P2, and BUILD-P3 loops into a first alpha-ready slice without adding new game systems: the world must not feel empty, critical failures must degrade safely, notifications must be best-effort only, browser smoke must exist, and release/staging/recovery steps must be reproducible from docs.

## In scope

- explicit alpha seed: base projects + demo-world actors/events;
- persisted Telegram write-access consent and bot notification dedupe;
- feed/UI markers for demo activity;
- safe API 500 handling and recoverable frontend states;
- Playwright smoke e2e for first value, social loop, and Exam loop;
- release checklist, staging deploy notes, and DB recovery/rollback notes;
- parameterized Docker/GHCR/VPS deploy workflow for staging vs production.

## Out of scope

- new game modes, currencies, quests, analytics ingestion, invites, or monetization;
- schedulers/cron for notifications;
- separate desktop-first UX;
- infra migration away from the current Docker + GHCR + VPS shape.

## Required user-visible result

- fresh user enters, chooses a role, gets first value, and sees a non-empty campus immediately;
- feed clearly marks demo/system activity as `Демо`;
- write-access prompt appears only after first value and does not reappear after consent is saved;
- social thanks/benefit events can trigger best-effort bot notifications without blocking the main path;
- three-user Exam loop still assembles, resolves, and stays replay-safe;
- operators have one documented release/staging/recovery path instead of oral knowledge.

## Mandatory checks for this phase

- `pnpm install`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- local PostgreSQL reachable through `DATABASE_URL`
- `pnpm --filter @sharaga/api prisma:migrate:deploy`
- `pnpm --filter @sharaga/api prisma:seed`
- `pnpm --filter @sharaga/web exec playwright install chromium`
- `pnpm --filter @sharaga/web test:e2e`

## Done when

- seed is idempotent and produces both base projects and explicit demo-world traces;
- `GET /api/v1/profile` returns `writeAccessGranted`, and consent persists through `/api/v1/notifications/write-access`;
- bot notification rows are deduped and do not break action/social/exam endpoints when delivery fails;
- frontend surfaces loading/retry/temporary-unavailable states for home/projects/feed/exam;
- smoke e2e proves first value, a two-user social thanks path, and a three-user Exam path;
- deploy/runbook docs describe production, staging, backup, restore, and rollback honestly.

## Known gaps

- `apps/web` still has placeholder `node --test` for non-browser unit tests; browser smoke now lives in Playwright instead of that script.
- local/browser notification smoke uses a documented local Telegram API stub through `TELEGRAM_BOT_API_BASE_URL`; public Telegram edge delivery is still covered by API best-effort/failure tests rather than the Playwright suite.

## Issues fixed in this pass

- Added explicit demo-world seed with demo-tagged actors/feed origin, plus idempotent seed guards.
- Persisted `writeAccessGranted`, added `BotNotification` storage with unique `dedupeKey`, and wired event-triggered confirmation/social/exam notification templates.
- Replaced raw 500 error leakage with stable safe responses and unified frontend retry/unavailable states.
- Added Playwright smoke infra with Telegram WebApp stub, multi-user contexts, local Telegram send stub, and serial alpha scenarios.
- Parameterized the Docker deploy workflow so staging uses the same shape as production with different environment/tag/path/port values.
- Fixed a real startup race: React StrictMode no longer leaves the app stuck in `checking`, and concurrent first-auth profile creation no longer 500s on Prisma `P2002`.

## Last verification

Date: 2026-04-22

Commands run (from repo root unless noted):

- `pnpm install` ✅
- `pnpm check` ✅
- `pnpm test` ✅
- `pnpm build` ✅
- `docker compose up -d db` ✅
- `pnpm --filter @sharaga/api prisma:migrate:deploy` ✅
- `pnpm --filter @sharaga/api prisma:seed` ✅
- `pnpm --filter @sharaga/web exec playwright install chromium` ✅
- `pnpm --filter @sharaga/web test:e2e` ✅

Smoke points verified locally:

- fresh user auth -> archetype -> first action -> write-access CTA -> consent persisted ✅
- demo feed and demo-world markers visible on first entry ✅
- two-user contribution -> thanks path -> one social notification row ✅
- three-user Exam queue -> ready -> auto-start -> replay-safe exam notifications ✅

## Next phase

CHECK-C4 - Alpha Gate
