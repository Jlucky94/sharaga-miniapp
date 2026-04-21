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

## Current test shape

- `packages/contracts` uses `tsx --test`.
- `apps/api` uses `tsx --test`.
- `apps/web` currently has a placeholder `node --test` script.
- Playwright is still the target e2e runner for later phases.

## Manual smoke test

1. Start PostgreSQL locally and export required API env vars in the shell that starts the API:

```powershell
docker compose up -d db
$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/sharaga_miniapp"
$env:TELEGRAM_BOT_TOKEN="123:token"
$env:JWT_SECRET="dev-jwt-secret"
```

2. Apply the checked-in BUILD-P1 migration:

```powershell
pnpm --filter @sharaga/api prisma:migrate:deploy
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

## Future runbooks to add

- DB seed.
- DB reset.
- Playwright e2e.
- Staging deploy.
- Rollback.
- Bot notification smoke test.
