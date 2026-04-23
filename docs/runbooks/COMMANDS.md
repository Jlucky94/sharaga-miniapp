# Commands

Run commands from the repository root unless noted otherwise.

## Prerequisites

- Node.js 18+
- pnpm 10.13.1+
- PostgreSQL 16+ or Docker for the local `db` service
- Telegram bot token for local auth testing

If `pnpm` is not available in PATH, use the pinned package-manager version through npm:

```powershell
npx pnpm@10.13.1 <command>
```

## Install

```powershell
pnpm install
```

`pnpm install` also generates the Prisma client for `apps/api`.

## Development

Run contracts, API, and web together:

```powershell
pnpm dev
```

Run API only:

```powershell
pnpm --filter @sharaga/api dev
```

Run web only:

```powershell
pnpm --filter @sharaga/web dev
```

## Required environment

API env example lives at `apps/api/.env.example`.

Required for API:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_API_BASE_URL` optional override for local notification smoke or a Telegram API stub
- `JWT_SECRET`
- `DATABASE_URL`

Web env example lives at `apps/web/.env.example`.

Useful for local web auth:

- `VITE_API_BASE_URL`
- `VITE_DEV_TELEGRAM_INIT_DATA`

## Local PostgreSQL

Start the documented local DB service:

```powershell
docker compose up -d db
```

Default local DB connection string:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/sharaga_miniapp"
```

If Docker is unavailable, point `DATABASE_URL` at any reachable PostgreSQL instance instead.

## Database commands

Generate Prisma client explicitly:

```powershell
pnpm --filter @sharaga/api prisma:generate
```

Apply the checked-in migration to the current database:

```powershell
pnpm --filter @sharaga/api prisma:migrate:deploy
```

Create a new migration while developing locally:

```powershell
pnpm --filter @sharaga/api prisma:migrate:dev
```

Seed the current database with the 3 campus projects used by BUILD-P2 and BUILD-P3:

```powershell
pnpm --filter @sharaga/api prisma:seed
```

Current BUILD-P4 seed is two-layer and idempotent:

- base projects: notes, gym, festival;
- demo world: 3 demo users with visible progress/social traces marked as `Демо`.

## Generate local Telegram initData

```powershell
$env:TELEGRAM_BOT_TOKEN="123:token"
pnpm --filter @sharaga/web gen:init-data
```

Paste the generated value into `apps/web/.env.local` as `VITE_DEV_TELEGRAM_INIT_DATA`.

## Checks

Typecheck all packages:

```powershell
pnpm check
```

Run tests:

```powershell
pnpm test
```

Build all packages:

```powershell
pnpm build
```

Run the web smoke suite:

```powershell
pnpm --filter @sharaga/web test:e2e
```

If Chromium is not installed yet for Playwright:

```powershell
pnpm --filter @sharaga/web exec playwright install chromium
```

## Current test shape

- `packages/contracts` uses `tsx --test`.
- `apps/api` uses `tsx --test`.
- `apps/web` keeps `node --test` as a placeholder unit-test script.
- `apps/web` uses Playwright for BUILD-P4 browser smoke in `pnpm --filter @sharaga/web test:e2e`.

## Manual first-value smoke

1. Start PostgreSQL locally and export required API env vars in the shell that starts the API:

```powershell
docker compose up -d db
$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/sharaga_miniapp"
$env:TELEGRAM_BOT_TOKEN="123:token"
$env:JWT_SECRET="dev-jwt-secret"
```

2. Apply the checked-in migrations and seed the shared alpha world:

```powershell
pnpm --filter @sharaga/api prisma:migrate:deploy
pnpm --filter @sharaga/api prisma:seed
```

3. Generate valid dev Telegram init data:

```powershell
$initData = pnpm --filter @sharaga/web gen:init-data
```

When scripting requests, use the generated line that starts with `auth_date=`.

4. Start `pnpm dev` from the same shell. Or start API and web separately:

```powershell
pnpm --filter @sharaga/api dev
pnpm --filter @sharaga/web dev
```

5. Open the Vite URL and confirm the app reaches archetype selection for a fresh user.
6. Select an archetype and perform one action.
7. Confirm `GET /api/v1/profile` returns saved progress with the returned JWT.
8. Reload the web app and confirm the same profile state is shown after re-auth.
9. Confirm `http://127.0.0.1:3001/api/v1/health` returns `{ "status": "ok" }`.

## Three-account cooperative Exam smoke

1. Reuse the same PostgreSQL + env shell as above, or start from a clean DB with the same commands.
2. Generate three distinct dev Telegram initData strings by overriding the helper env vars before each run:

```powershell
$env:TELEGRAM_BOT_TOKEN="123:token"

$env:TG_DEV_USER_ID="81001"
$env:TG_DEV_FIRST_NAME="Alice"
$env:TG_DEV_USERNAME="alice81001"
pnpm --filter @sharaga/web gen:init-data

$env:TG_DEV_USER_ID="81002"
$env:TG_DEV_FIRST_NAME="Bob"
$env:TG_DEV_USERNAME="bob81002"
pnpm --filter @sharaga/web gen:init-data

$env:TG_DEV_USER_ID="81003"
$env:TG_DEV_FIRST_NAME="Cora"
$env:TG_DEV_USERNAME="cora81003"
pnpm --filter @sharaga/web gen:init-data
```

3. Open three separate browser sessions, or script the same flow through the API with the three generated `initData` values.
4. For the three users, select different archetypes: `botan`, `sportsman`, `partygoer`.
5. From one user, queue into Exam with capacity `3`. From the other two users, queue into Exam with the same capacity until the party reaches `ready_check`.
6. Mark all three members ready and confirm the final ready triggers immediate auto-start.
7. Confirm `/api/v1/exam` returns `latestRun`, every member profile shows reward deltas after reload, and `/api/v1/feed` shows exactly one `exam_result`.
8. Confirm the same `exam_result` is visible for a non-owner user as well as the owner.
9. Repeat the final `POST /api/v1/parties/:id/ready` once more and confirm rewards/feed state do not change.

## Playwright alpha smoke

1. Start PostgreSQL locally and export the API env vars:

```powershell
docker compose up -d db
$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/sharaga_miniapp"
$env:TELEGRAM_BOT_TOKEN="dev-bot-token"
$env:JWT_SECRET="dev-jwt-secret"
```

2. Install Chromium once if Playwright has not downloaded it yet:

```powershell
pnpm --filter @sharaga/web exec playwright install chromium
```

3. Run the smoke suite:

```powershell
pnpm --filter @sharaga/web test:e2e
```

What this suite covers:

- fresh user auth -> archetype -> first action -> write-access CTA;
- visible demo feed/demo-world markers;
- two-user contribution -> thanks path with social notification row;
- three-user Exam queue -> ready -> auto-start -> replay-safe notification dedupe.

Notes:

- the suite starts API/web automatically, migrates the DB, resets it, re-runs the seed, and uses a local Telegram API stub through `TELEGRAM_BOT_API_BASE_URL`;
- the suite still requires a real PostgreSQL reachable through `DATABASE_URL`.

## Additional runbooks

- [Release Checklist](./RELEASE_CHECKLIST.md)
- [Staging Deploy](./STAGING.md)
- [Recovery And Rollback](./RECOVERY.md)
