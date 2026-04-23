# Current Phase

## Active phase

Phase: CHECK-C4 - Alpha Gate

## Goal

Verify the full path from BUILD-P0 through BUILD-P4 without expanding scope: clean setup must work, the first-value/social/exam loops must stay playable, notifications must remain best-effort, and the documented seed/staging/recovery path must be honest and reproducible for the first external alpha test.

## In scope

- start-from-scratch verification through the documented commands;
- confirmation of first value, async social, and three-user Exam paths;
- confirmation that notifications do not block the main path;
- confirmation that seed remains idempotent and docs remain reproducible;
- only critical alpha-ready fixes discovered during verification.

## Out of scope

- new product systems, currencies, quests, invites, monetization, or analytics ingestion;
- architectural rewrites or infra migration away from Docker + GHCR + VPS;
- desktop-first UX work;
- non-critical polish unrelated to alpha readiness.

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

- project starts from scratch by the documented path;
- a fresh user still gets first value and sees a non-empty campus;
- the two-user async social loop still works without duplicate rewards/feed;
- the three-user Exam path resolves once and stays replay-safe;
- notification delivery failures do not block main-path endpoints;
- seed/staging/recovery docs remain honest and reproducible;
- no known critical blocker remains for the first external test.

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
- Fixed an alpha-gate Exam UI race: when the final `ready` resolves through a concurrent member request, the screen now refreshes immediately instead of waiting for the next polling tick to show `Последний результат`.

## Last verification

Date: 2026-04-23

Commands run (from repo root unless noted):

- `pnpm install` ✅
- `docker compose up -d db` ✅
- `pnpm --filter @sharaga/api prisma:migrate:deploy` ✅
- `pnpm --filter @sharaga/api prisma:seed` ✅
- `pnpm --filter @sharaga/api prisma:seed` (re-run idempotency check) ✅
- `pnpm check` ✅
- `pnpm test` ✅
- `pnpm build` ✅
- `pnpm --filter @sharaga/web exec playwright install chromium` ✅
- `pnpm --filter @sharaga/web test:e2e` ✅

Alpha-gate points confirmed:

- project start-from-scratch path works once Docker Desktop is available locally ✅
- fresh user auth -> archetype -> first action -> write-access CTA -> consent persisted ✅
- demo feed and demo-world markers visible on first entry ✅
- two-user contribution -> thanks path -> one social notification row ✅
- three-user Exam queue -> ready -> auto-start -> replay-safe exam notifications ✅
- release, staging, and recovery docs still match the current deploy/recovery shape ✅

Residual notes:

- `apps/web` unit `test` remains a placeholder `node --test`; browser truth for alpha still lives in Playwright by design and is not treated as a release blocker for CHECK-C4.
- Local verification still assumes Docker Desktop or another reachable PostgreSQL for `DATABASE_URL`; without that environment prerequisite, the app cannot be verified from scratch.

## Next phase

Closed at CHECK-C4. Do not start the next roadmap phase without a direct request.
