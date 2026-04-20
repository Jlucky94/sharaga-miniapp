# Project Notes For AI Agents

## Mission

Build a social Telegram Mini App game in a school/university setting.

The product core is:

- personal short loop;
- async social contribution to a shared campus world;
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

Do not read, scan, or index `prompts/` during normal work. That directory is an execution prompt library. Open a file inside it only when the user gives an explicit prompt path or directly asks to work with that directory.

## Working loop

1. Restate the current phase goal and boundaries in your own words.
2. List touched modules and intended changes before broad edits.
3. Implement the smallest integrated slice that satisfies the active phase contract.
4. Run the mandatory checks from `docs/runbooks/COMMANDS.md`.
5. Fix until the relevant checks are green or record the exact blocker.
6. Update `docs/status/CURRENT_PHASE.md` and any docs that changed in substance.
7. Stop when the phase contract is satisfied. Do not start the next phase without a direct request.

## Non-negotiables

- Preserve existing working flows.
- Prefer modifying current code over parallel rewrites.
- No placeholder product logic without an explicit TODO and scope note.
- No new dependency without an explicit rationale in code review notes or `docs/decisions/DECISIONS.md`.
- No hidden schema changes without migration, seed/update plan, and docs update.
- Do not change product scope on your own.
- Treat the game as event-driven: important player actions should be recordable as domain events.

## Current foundation

This repository intentionally starts as a Telegram Mini App infrastructure shell.

The Telegram-related files were copied from a previously deployed and working mini app, then stripped of product-specific auction/game logic. Keep this foundation unless the user explicitly asks to replace the Telegram integration:

- `apps/api/src/auth.ts` validates Telegram `initData` using the bot token and Telegram's WebApp signature rules.
- `apps/api/src/jwt.ts` issues a small internal JWT after Telegram auth succeeds.
- `apps/api/src/app.ts` exposes `/api/v1/auth/telegram`, `/api/v1/me`, and `/api/v1/health`.
- `apps/web/src/main.tsx` reads `window.Telegram.WebApp.initData`, falls back to `VITE_DEV_TELEGRAM_INIT_DATA` in dev, and calls the API auth endpoint.
- `apps/web/scripts/generate-dev-init-data.mjs` generates locally valid Telegram initData for development when given `TELEGRAM_BOT_TOKEN`.
- `apps/web/nginx.conf`, `apps/web/vite.config.ts`, Dockerfiles, `docker-compose.yml`, and `.github/workflows/deploy.yml` preserve the working API proxy/deployment shape.

When adding product features, build on top of this shell rather than moving auth into frontend-only code. Server-side initData validation is the important part.

## If blocked

- Record the blocker in `docs/status/CURRENT_PHASE.md` if it affects phase progress.
- Propose 1-3 concrete options.
- State the exact missing decision.
