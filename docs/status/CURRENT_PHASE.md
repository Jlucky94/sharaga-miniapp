# Current Phase

## Active phase

Phase: BUILD-P3 - Cooperative Exam

## Goal

Prove that a small party can gather for the Exam, where archetype composition materially affects the result and the outcome leaves a visible social trace.

## In scope

- One active weekly-framed Exam event exposed through `/api/v1/exam`.
- Party capacity choice `3 / 4 / 5`.
- Queue + autofill party assembly.
- Ready check and automatic start once the party is full and every member is ready.
- Deterministic backend Exam rules with two visible outcomes: `success`, `partial_failure`.
- Per-member rewards written once with idempotent completion behavior.
- One Exam result entry in the shared social feed.
- Three-account scenario covered by tests.

## Out of scope

- Manual invites or public party browser.
- PvP, guilds, seasons, battle pass, marketplace.
- Separate scheduler/calendar system for Exam windows.
- Energy cost or cooldown for Exam participation.
- Browser automation beyond current placeholder web tests.

## Required user-visible result

- Player opens the app and sees a new `Экзамен` tab.
- Player chooses party size and enters queue.
- Autofill gathers a full party.
- Members mark readiness.
- Exam starts automatically and resolves to either `success` or `partial_failure`.
- Rewards apply once, survive reload, and the result appears in the shared feed.

## Mandatory checks for this phase

- `pnpm install`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- local PostgreSQL reachable through `DATABASE_URL`
- `pnpm --filter @sharaga/api prisma:migrate:deploy` applies BUILD-P3 schema (migration `20260423000000_build_p3_exam`)
- `pnpm --filter @sharaga/api prisma:seed`
- manual three-account smoke: queue -> full party -> all ready -> autostart -> rewards + feed entry

## Done when

- BUILD-P1 and BUILD-P2 regressions still pass.
- Exam unit, queue, and scenario tests pass.
- Web shows Home + Projects + Exam + Feed tabs.
- Party state remains consistent after reload and repeated ready requests.
- Exam rewards and feed entry do not duplicate.
- Docs reflect BUILD-P3 behavior and remaining verification gaps honestly.

## Known gaps

- Live PostgreSQL migration and manual three-account smoke were not run in this verification pass because no DB session was exercised here.
- `apps/web` still uses placeholder `node --test`; browser automation remains a later phase concern.
- Exam currently uses queue + autofill only; manual invite flows remain out of scope for BUILD-P3.

## Last verification

Date: 2026-04-22

Commands run (from repo root):
- `pnpm install` ✅ — workspace already up to date; Prisma client regenerated.
- `pnpm check` ✅ — zero TypeScript errors across contracts, API, and web.
- `pnpm test` ✅ — 37 API tests + 4 contract tests pass, 0 fail.
- `pnpm build` ✅ — contracts, API, and web compile; web production bundle built successfully.

Contract points verified locally:

| BUILD-P3 point | Result |
|---|---|
| Queue + autofill creates/fills a party | ✅ `exam.queue.test.ts` |
| Full party moves into readiness | ✅ `exam.queue.test.ts` |
| Final ready triggers automatic Exam start | ✅ `exam.scenario.test.ts` |
| Outcome depends on archetype composition logic | ✅ `exam.unit.test.ts` |
| Rewards apply and persist on profile | ✅ `exam.unit.test.ts` + `exam.scenario.test.ts` |
| Feed receives one Exam result item | ✅ `exam.scenario.test.ts` + existing feed tests |
| BUILD-P1 / BUILD-P2 regressions remain green | ✅ existing auth + social suites |

Not yet verified in this pass:
- `prisma:migrate:deploy` against a live PostgreSQL database
- `prisma:seed` against a live PostgreSQL database
- manual three-account browser/API smoke against live DB

## Next phase

CHECK-C3 - Cooperative Event Control
