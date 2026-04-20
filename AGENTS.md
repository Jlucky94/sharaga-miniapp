# Project Notes For AI Agents

This repository intentionally starts as a Telegram Mini App infrastructure shell.

The Telegram-related files were copied from a previously deployed and working mini app, then stripped of product-specific auction/game logic. Keep this foundation unless the user explicitly asks to replace the Telegram integration:

- `apps/api/src/auth.ts` validates Telegram `initData` using the bot token and Telegram's WebApp signature rules.
- `apps/api/src/jwt.ts` issues a small internal JWT after Telegram auth succeeds.
- `apps/api/src/app.ts` exposes `/api/v1/auth/telegram`, `/api/v1/me`, and `/api/v1/health`.
- `apps/web/src/main.tsx` reads `window.Telegram.WebApp.initData`, falls back to `VITE_DEV_TELEGRAM_INIT_DATA` in dev, and calls the API auth endpoint.
- `apps/web/scripts/generate-dev-init-data.mjs` generates locally valid Telegram initData for development when given `TELEGRAM_BOT_TOKEN`.
- `apps/web/nginx.conf`, `apps/web/vite.config.ts`, Dockerfiles, `docker-compose.yml`, and `.github/workflows/deploy.yml` preserve the working API proxy/deployment shape.

When adding product features, build on top of this shell rather than moving auth into frontend-only code. Server-side initData validation is the important part.
