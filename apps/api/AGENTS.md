# API Agent Notes

## Scope

`apps/api` owns:

- Telegram `initData` validation;
- internal JWT issuing and verification;
- authenticated REST API endpoints;
- future persistence, domain orchestration, bot webhook, scheduled jobs, and analytics intake.

## Rules

- Never trust Telegram user fields from the frontend without server-side `initData` validation.
- Keep product endpoints under `/api/v1`.
- Return structured JSON errors with stable `code` and human-readable `message`.
- Keep game formulas deterministic and unit-tested; promote them to `packages/game-core` when reused.
- Add request/response schemas through `packages/contracts` once contracts stabilize.
- Do not hide in-memory state behind product behavior that is expected to persist.

## Current commands

From repo root:

```powershell
pnpm --filter @sharaga/api dev
pnpm --filter @sharaga/api check
pnpm --filter @sharaga/api test
pnpm --filter @sharaga/api build
```

## Current caveat

User storage is currently in memory. Any feature that promises saved progress requires persistent storage before it can close its phase contract.
