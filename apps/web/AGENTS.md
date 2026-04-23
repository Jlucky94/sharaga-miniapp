# Web Agent Notes

## Scope

`apps/web` owns:

- Telegram Mini App bootstrap;
- frontend auth call to `/api/v1/auth/telegram`;
- player-facing UI;
- future TanStack Query server-state integration;
- future Telegram UX hooks such as BackButton, MainButton, haptics, fullscreen, sharing, add-to-home-screen, and write access prompts.

## Rules

- Read Telegram `initData`, but do not treat frontend Telegram data as trusted identity.
- Keep auth flow compatible with `VITE_DEV_TELEGRAM_INIT_DATA` for local development.
- Treat the Mini App as mobile-first and mobile-only in product design terms: prioritize phone viewport UX and do not invent separate desktop-oriented screens unless explicitly requested.
- Design moments of value, not generic pages.
- First product screen should lead to archetype choice and one obvious meaningful action.
- Ask write access only after first value moment.
- Use Telegram native controls functionally, not decoratively.
- Avoid adding a marketing landing page; the Mini App should open directly into the usable experience.
- Desktop rendering only needs to remain usable enough for development/debugging; it does not need dedicated product design work by default.

## Current commands

From repo root:

```powershell
pnpm --filter @sharaga/web dev
pnpm --filter @sharaga/web check
pnpm --filter @sharaga/web test
pnpm --filter @sharaga/web test:e2e
pnpm --filter @sharaga/web build
pnpm --filter @sharaga/web gen:init-data
```
