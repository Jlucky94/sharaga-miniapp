# Claude Code Project Notes

This file mirrors the project contract in `AGENTS.md`. Keep both files aligned in meaning.

## Mission

Build a social Telegram Mini App game in a school/university setting:

- personal short loop;
- async social contribution;
- small-group weekly cooperative event;
- visible gratitude, reputation, and social traces.

Do not add systems outside the current phase.

## Read first

1. `docs/status/CURRENT_PHASE.md`
2. `docs/roadmap/ROADMAP.md`
3. `docs/architecture/ARCHITECTURE.md`
4. `docs/domain/GAME_DESIGN.md`
5. `docs/runbooks/COMMANDS.md`
6. relevant local `AGENTS.md` files in touched directories
7. `docs/decisions/DECISIONS.md` when changing architecture, stack, storage, or contracts

## Working loop

1. Restate the current phase goal and boundaries.
2. List touched modules and intended changes before broad edits.
3. Implement the smallest integrated slice that satisfies the active phase contract.
4. Run the mandatory checks from `docs/runbooks/COMMANDS.md`.
5. Fix until green or record the exact blocker.
6. Update `docs/status/CURRENT_PHASE.md` and any docs that changed in substance.
7. Stop when the phase contract is satisfied.

## Non-negotiables

- Preserve the existing Telegram auth and deployment shell.
- Validate Telegram `initData` on the server; never move trust into frontend-only code.
- Prefer modifying current code over parallel rewrites.
- No placeholder product logic without an explicit TODO and scope note.
- No new dependency without rationale.
- No hidden schema changes without migration, seed/update plan, and docs update.
- Treat the game as event-driven: important player actions should be recordable as domain events.

## If blocked

Record the blocker in `docs/status/CURRENT_PHASE.md`, propose 1-3 concrete options, and state the exact missing decision.
