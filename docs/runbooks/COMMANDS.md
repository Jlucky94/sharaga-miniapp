# Commands

Run commands from the repository root unless noted otherwise.

## Prerequisites

- Node.js 18+
- pnpm 10.13.1+
- Telegram bot token for local auth testing

If `pnpm` is not available in PATH, use the pinned package-manager version through npm:

```powershell
npx pnpm@10.13.1 <command>
```

## Install

```powershell
pnpm install
```

## Development

Run API and web together:

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

Web env example lives at `apps/web/.env.example`.

Useful for local web auth:

- `VITE_API_BASE_URL`
- `VITE_DEV_TELEGRAM_INIT_DATA`

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

- `apps/api` uses `tsx --test`.
- `apps/web` currently has a placeholder `node --test` script.
- Vitest is the target test runner for domain/contracts as the product grows.
- Playwright is the target e2e runner once BUILD-P1 creates a real user journey.

## Manual smoke test

1. Create `apps/api/.env.local` or export required API env vars.
2. Generate valid dev Telegram init data.
3. Start `pnpm dev`.
4. Open the Vite URL.
5. Confirm the web app calls `/api/v1/auth/telegram`.
6. Confirm `/api/v1/me` succeeds with the returned JWT.
7. Confirm `/api/v1/health` returns `{ "status": "ok" }`.

## Future runbooks to add

- DB migrate.
- DB seed.
- DB reset.
- Playwright e2e.
- Staging deploy.
- Rollback.
- Bot notification smoke test.
