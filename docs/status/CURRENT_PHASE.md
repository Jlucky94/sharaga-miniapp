# Current Phase

## Active phase

Phase: BUILD-P0 - Project operating system

## Goal

Create a working project shell that a developer or AI agent can understand, run, verify, and extend without oral context.

This repository already has a working Telegram Mini App foundation. BUILD-P0 is therefore mostly about documenting the operating model and confirming the shell remains intact before product mechanics start.

## In scope

- Keep the existing Telegram Mini App auth/deploy foundation.
- Document the AI-first phase workflow.
- Document the current monorepo shape and target stack.
- Document local commands for install, dev, build, check, tests, and Telegram dev init data.
- Define the product/domain constraints for the school/university social game.
- Add local agent rules for `apps/api` and `apps/web`.

## Out of scope

- Game mechanics.
- Database schema implementation.
- Prisma/Neon setup.
- TanStack Query integration.
- Parties, async projects, quests, events, inventory, or analytics implementation.
- UI polish beyond the current shell.

## Required user-visible result

A new contributor can open the repository and understand:

- what product is being built;
- what phase is active;
- which commands are canonical;
- which Telegram integration must be preserved;
- which documents govern roadmap, architecture, domain rules, decisions, and checks.

## Mandatory checks for this phase

- `pnpm install`
- `pnpm check`
- `pnpm test`
- `pnpm build`
- API health endpoint works during local development when env vars are configured.
- Web app can authenticate against the API using valid Telegram dev init data.

## Done when

- `AGENTS.md`, `CLAUDE.md`, `CURRENT_PHASE.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `GAME_DESIGN.md`, `COMMANDS.md`, and `DECISIONS.md` exist and agree with each other.
- The existing Telegram shell is not replaced or bypassed.
- Commands in `COMMANDS.md` match real package scripts.
- Known gaps are recorded below instead of hidden in chat history.

## Known gaps

- There is no persistent database yet; API user state is currently in memory.
- `packages/contracts` and `packages/game-core` are recommended by the target architecture but not created yet.
- TanStack Query, Prisma, PostgreSQL/Neon, Playwright, and structured analytics are target stack items for later phases, not current dependencies.
- No e2e test suite exists yet.

## Next phase

BUILD-P1 - First value for a new player.

Start only after BUILD-P0 has been checked and the user asks to implement product mechanics.
