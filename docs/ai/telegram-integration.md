# Telegram Mini App Integration

This project keeps a known-working Telegram Mini App base from `car-auction-miniapp` so future work does not need to rediscover the Telegram setup.

Important pieces:

- Backend validation lives in `apps/api/src/auth.ts`. It verifies Telegram `initData` with `TELEGRAM_BOT_TOKEN`, rejects invalid signatures, and enforces a max auth age.
- Backend session issuing lives in `apps/api/src/jwt.ts` and `apps/api/src/app.ts`. The frontend never trusts Telegram data by itself; it sends `initData` to `/api/v1/auth/telegram`, then uses the returned JWT for authenticated API calls.
- Frontend Telegram bootstrap lives in `apps/web/src/main.tsx`. It reads `window.Telegram.WebApp.initData` inside Telegram and `VITE_DEV_TELEGRAM_INIT_DATA` during Vite development.
- Local dev initData can be generated with `TELEGRAM_BOT_TOKEN=<token> pnpm --filter @sharaga/web gen:init-data`, then pasted into `apps/web/.env.local`.
- Runtime/deploy wiring is in `apps/web/nginx.conf`, `apps/web/vite.config.ts`, `apps/*/Dockerfile`, `docker-compose.yml`, and `.github/workflows/deploy.yml`.

Do not remove these files as unused scaffolding. They are the deployment and Telegram auth foundation for the mini app. Product-specific UI and API endpoints should be added around this base.
