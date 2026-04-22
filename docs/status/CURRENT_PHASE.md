# Current Phase

## Active phase

Phase: BUILD-P2 - Async Social World

## Goal

Prove that one player can help another asynchronously and receive a visible social signal. The emotional target is "my contribution helped another player" — if reuse is invisible the feature fails.

## In scope

- 3 campus projects: Notes (botan), Gym (sportsman), Festival Stage (partygoer).
- Player A contributes to a project (costs 1 energy, grants XP + currency + archetype XP).
- Project has a progress threshold; reaching it unlocks the benefit for other players.
- Player B (non-contributor) can claim the unlocked benefit (one-time per unlock cycle).
- When B claims, A receives reputation and a feed entry.
- Any player can like/thank a contribution; author receives +1 reputation.
- Global social feed shows: contributions, unlocks, benefit claims, likes.
- Repeated requests and reload do not duplicate rewards (client requestId idempotency + DB unique constraints).
- Two-account scenario covered by tests.

## Out of scope

- Cooperative Exam or parties.
- Guilds, PvP, seasons.
- New archetypes beyond the base three.
- New currencies (reputation and existing soft currency only).
- Daily/weekly quests.

## Required user-visible result

- Player A opens the app, goes to Projects tab, contributes to a campus project.
- With enough contributions the project unlocks.
- Player B opens the app, sees the unlocked project, claims the benefit.
- Player A reopens the app and sees: reputation increased, feed shows B's claim and/or like.
- No double-rewards on retry or reload.

## Mandatory checks for this phase

- `pnpm install`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- local PostgreSQL reachable through `DATABASE_URL`
- `pnpm --filter @sharaga/api prisma:migrate:deploy` applies BUILD-P2 schema (migration `20260422000000_build_p2_social`)
- `pnpm --filter @sharaga/api prisma:seed` seeds 3 campus projects
- manual two-account smoke: A contributes until unlock → B claims benefit → A sees reputation + feed entry

## Done when

- All five social test files pass (projects, benefit, likes, feed, scenario).
- Two-account scenario end-to-end works via API.
- Front-end shows Home + Projects + Feed tabs with working social loop.
- State is consistent after reload and repeated requests.
- BUILD-P1 first-value-loop test still passes (regression check).
- Docs reflect verified BUILD-P2 state.

## Known gaps

- `apps/web` tests are still node --test placeholder; browser automation is a later-phase concern.
- Soft-deletion / reset of project cycles is out of scope for BUILD-P2.
- Core user-facing copy is now expected to stay Russian-first across web UI, action catalog, project display text, and API human-readable messages; technical ids remain English by design.
- Manual browser smoke for the Russian-first copy pass is still pending; browser automation remains a later-phase concern.

## Last verification

Date: 2026-04-22

Commands run (from repo root):
- `pnpm install` ✅ — workspace dependencies up to date, Prisma client generated.
- `pnpm check` ✅ — zero TypeScript errors across all 3 packages.
- `pnpm test` ✅ — 34 tests pass, 0 fail:
  - `packages/contracts`: 4/4 (archetype schema, action catalog, profile DTO, request/response alignment).
  - `apps/api auth.test.ts`: 6/6 (BUILD-P1 regression — Telegram auth, profile creation, archetype selection, action perform, reload state).
  - `apps/api social.projects.test.ts`: 5/5 (contribute happy path, requestId idempotency, energy exhaustion, unlock at threshold, post-unlock rejection).
  - `apps/api social.benefit.test.ts`: 5/5 (claim flow, duplicate rejection, contributor exclusion, locked-project rejection, reputation bump on A).
  - `apps/api social.likes.test.ts`: 4/4 (like creation, duplicate rejection, self-like rejection, reputation increment).
  - `apps/api social.feed.test.ts`: 3/3 (event ordering, all 4 event kinds, cursor pagination).
  - `apps/api social.scenario.test.ts`: 1/1 (two-account full loop: A contributes until unlock → B claims benefit → B likes → A sees reputation + feed signal).
  - `apps/web`: 0 tests (placeholder — known gap per phase contract).
- `pnpm build` ✅ — contracts, API, and web all compile; Vite prod bundle 218 kB.

Contract points verified:

| C2 point | Result |
|---|---|
| First path (P0+P1 regression) — new player auth, archetype, action, reload | ✅ auth.test.ts green |
| A contributes to shared project (energy cost, XP, requestId idempotency) | ✅ social.projects.test.ts |
| Project unlocks at threshold; post-unlock contribution rejected | ✅ social.projects.test.ts |
| B claims unlocked benefit once; retry returns 409 | ✅ social.benefit.test.ts |
| A receives reputation when B claims; feed shows benefit_claimed | ✅ social.benefit.test.ts + social.scenario.test.ts |
| Like gives +1 reputation to author; self-like and duplicate rejected | ✅ social.likes.test.ts |
| Feed shows all 4 event kinds; keyset pagination works | ✅ social.feed.test.ts |
| State consistent after repeated requests and reload | ✅ social.scenario.test.ts |
| Two-account end-to-end scenario | ✅ social.scenario.test.ts |

Live DB verification (Docker):
- `docker compose up -d db` ✅ — PostgreSQL 16 container started.
- `prisma:migrate:deploy` ✅ — migration `20260422000000_build_p2_social` applied; all 2 migrations current.
- `prisma:seed` ✅ — 3 campus projects upserted (notes/gym/festival); re-run idempotent.
- Live two-account API smoke (festival project, threshold=4):

  | Step | Result |
  |---|---|
  | P1 regression — new profile saved after archetype select | ✅ archetype=partygoer, energy=3 |
  | A contributes 3x — progress 1→3, energy depletes correctly | ✅ |
  | B contributes 1x — progress=4/4, unlocked=true | ✅ |
  | A reputation after unlock | ✅ reputation=3 |
  | C (non-contributor) claims benefit — softCurrency granted | ✅ softCurrency=2 |
  | C duplicate claim | ✅ BENEFIT_ALREADY_CLAIMED |
  | B tries to claim (contributor exclusion) | ✅ CONTRIBUTOR_CANNOT_CLAIM |
  | A feed shows benefit/unlock/contribution/like events with projectTitle | ✅ all 4 kinds present |
  | C likes A's contribution | ✅ like recorded |
  | C duplicate like | ✅ ALREADY_LIKED |
  | A self-like | ✅ SELF_LIKE |
  | A final reputation after unlock + like | ✅ reputation=6 |
  | Reload — re-auth A, same profile state | ✅ archetype=partygoer reputation=6 |
  | Feed cursor pagination | ✅ nextCursor returned, page 2 loads |

- Web UI smoke (browser click-through) was not performed; browser automation is a known gap for this phase.

## Next phase

BUILD-P3 — Cooperative Event Exam
