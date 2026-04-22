# Current Phase

## Active phase

Phase: CHECK-C3 - Cooperative Event Control

## Goal

Verify BUILD-P0, BUILD-P1, BUILD-P2, and BUILD-P3 cumulatively so we can honestly say the cooperative Exam closes its contract without breaking the earlier shell, auth, profile, or async social loops.

## In scope

- Confirm the early player path still works: Telegram auth, profile load, archetype choice, one action, reload.
- Confirm async social still works: shared projects, benefit claim, thanks/likes, feed visibility, no duplicate rewards.
- Confirm cooperative Exam still works end to end: queue + autofill, ready check, auto-start, deterministic outcome engine, one-time rewards, shared feed result.
- Fix only blockers that prevent the cooperative event contract from being honestly closed.

## Out of scope

- BUILD-P4 hardening such as browser automation, release checklists, notifications, or staging workflows.
- Manual invites, public party browser, PvP, guilds, seasons, marketplace, or any new game mode.
- Desktop-first UX work or separate desktop layouts.

## Required user-visible result

- Early user paths from BUILD-P1 and BUILD-P2 still behave correctly after the Exam work.
- Player can enter the `Экзамен` tab, choose capacity `3 / 4 / 5`, join queue, and get autofilled into a full party.
- Full party reaches ready check, final ready auto-starts the Exam, and the run resolves into `success` or `partial_failure`.
- Rewards survive reload and repeated requests, and the result appears once in the shared feed for both owner and non-owner viewers.

## Mandatory checks for this phase

- `pnpm install`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- local PostgreSQL reachable through `DATABASE_URL`
- `pnpm --filter @sharaga/api prisma:migrate:deploy`
- `pnpm --filter @sharaga/api prisma:seed`
- `pnpm --filter @sharaga/web gen:init-data` for three distinct dev users
- live three-account cooperative Exam smoke against PostgreSQL (API-backed or UI-backed)

## Done when

- BUILD-P0 through BUILD-P3 regressions stay green.
- Exam tests explicitly prove:
  - mixed composition is materially stronger than mono-party;
  - a fixed-seed `success` path exists;
  - a fixed-seed `partial_failure` path exists;
  - repeated final `ready` does not duplicate `ExamRun`, `ExamReward`, or `exam_completed`.
- Live PostgreSQL Exam smoke passes with one shared `exam_result` visible to a non-owner account.
- Docs reflect the real verification state and known gaps honestly.

## Known gaps

- `apps/web` still uses placeholder `node --test`; browser automation remains a later phase concern.
- This verification pass used a live PostgreSQL API-backed three-account smoke instead of a dedicated browser-only three-client manual run.

## Issues fixed in this pass

- Added explicit CHECK-C3 regressions for deterministic `success` and `partial_failure` Exam outcomes, material role-composition advantage, non-owner feed visibility, and idempotent final `ready`.
- Fixed the real PostgreSQL `/api/v1/parties/queue` path, which was failing with `500` because the runtime Prisma client did not include BUILD-P3 models under a locked Windows engine DLL workflow.
- Moved Prisma client generation to a repo-local generated client and added a Windows-safe postinstall/generate fallback to `--no-engine` when the engine DLL is already locked by a running dev process.

## Last verification

Date: 2026-04-22 (re-run)

Commands run (from repo root unless noted):

- `pnpm install` ✅ — workspace already up to date; Prisma client regenerated with engine (DLL unlocked after prior session ended).
- `pnpm check` ✅ — zero TypeScript errors across contracts, API, and web.
- `pnpm test` ✅ — 39 API tests + 4 contract tests pass, 0 fail.
- `pnpm build` ✅ — contracts, API, and web compile; web production bundle built successfully.
- `docker compose up -d db` ✅ — local PostgreSQL service reachable.
- `pnpm --filter @sharaga/api prisma:migrate:deploy` ✅ — no pending migrations, schema current.
- `pnpm --filter @sharaga/api prisma:seed` ✅ — 3 campus projects upserted.
- `pnpm --filter @sharaga/web gen:init-data` x3 ✅ — distinct dev initData generated for Alice(81001)/Bob(81002)/Cora(81003).
- `node apps/api/scripts/smoke-c3.mjs` ✅ — all 7 smoke points passed against live PostgreSQL:
  - queue → full party (ready_check) ✅
  - all ready → auto-start → outcome `success`, 3 rewards ✅
  - all three profiles show XP > 0 after run ✅
  - `/exam` latestRun.partyId matches current party ✅
  - owner and non-owner (Bob) each see exactly 1 `exam_result` for current partyId ✅
  - replay final ready returns same run.id, profiles unchanged, feed not duplicated ✅

Contract points verified locally:

| CHECK-C3 point | Result |
|---|---|
| Earlier user paths are not broken | ✅ existing auth/profile suites + root `pnpm test` |
| Party can be created and assembled | ✅ `exam.queue.test.ts` + live PostgreSQL smoke |
| Exam depends on role composition | ✅ `exam.unit.test.ts` |
| Successful and partially failed paths both exist | ✅ `exam.unit.test.ts` fixed-seed cases |
| Rewards and result records do not duplicate | ✅ `exam.scenario.test.ts` + live PostgreSQL smoke idempotency check |
| Event result appears in shared social space | ✅ `exam.scenario.test.ts` + live non-owner (Bob) feed check |

## Next phase

BUILD-P4 - Alpha Candidate
