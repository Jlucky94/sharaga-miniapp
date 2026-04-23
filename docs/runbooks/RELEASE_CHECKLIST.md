# Release Checklist

Use this before the first alpha push and before any later production release.

## Preconditions

- production secrets are present in the GitHub environment `sharaga-miniapp`;
- VPS disk, Docker, and PostgreSQL are healthy;
- a fresh PostgreSQL dump path is ready before deployment;
- no unresolved critical blocker remains in `docs/status/CURRENT_PHASE.md`.

## Local verification

Run from repo root:

```powershell
pnpm install
pnpm check
pnpm test
pnpm build
pnpm --filter @sharaga/api prisma:migrate:deploy
pnpm --filter @sharaga/api prisma:seed
pnpm --filter @sharaga/web test:e2e
```

Confirm:

- new user reaches first value and sees a non-empty campus;
- demo activity is clearly marked `Демо`;
- write-access path persists `writeAccessGranted`;
- social thanks path still works;
- three-user Exam flow resolves once and feed/result do not duplicate.

## Backup before deploy

Take a PostgreSQL dump on the target environment before restarting containers:

```bash
pg_dump "$DATABASE_URL" > sharaga-miniapp-predeploy-$(date +%Y%m%d-%H%M%S).sql
```

Keep the most recent verified dump outside the container filesystem if possible.

## Deploy

- production auto-deploy runs on push to `master`;
- manual deploy is available through GitHub Actions `Deploy (Docker)` with target `production` or `staging`;
- production images use GHCR tags `latest`;
- staging images use GHCR tags `staging`.

After deploy:

- open `/api/v1/health`;
- open the web app and complete one first-value path;
- verify `docker compose ps` shows `api` and `web` healthy on the VPS;
- verify the latest migration is applied and `prisma:seed` is still idempotent if re-run.

## Stop conditions

Do not continue rollout if any of the following are true:

- migrations fail or leave schema drift;
- seed duplicates demo users/events;
- write-access or notification failures block business endpoints;
- social or Exam smoke shows duplicated rewards/feed/notifications.
