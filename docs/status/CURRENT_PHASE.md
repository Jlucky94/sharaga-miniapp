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

## Last verification

(pending — to be filled in after CHECK-C2)

## Next phase

CHECK-C2 - Async Social Loop Control
