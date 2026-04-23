# Staging Deploy

BUILD-P4 keeps staging on the same Docker + GHCR + VPS shape as production. The difference is deployment target, image tag, directory, and secrets.

## GitHub setup

Create a GitHub Environment named `sharaga-miniapp-staging` with the same secret keys as production:

- `VPS_SSH_KEY`
- `VPS_HOST`
- `VPS_USER`
- `TELEGRAM_BOT_TOKEN`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `DATABASE_URL`

Recommended staging differences:

- separate PostgreSQL database/schema;
- separate bot token if possible;
- same VPS is acceptable if deploy directory and host port differ.

## Manual staging run

Open GitHub Actions and run `Deploy (Docker)` with target `staging`.

The workflow will:

- build and push `ghcr.io/jlucky94/sharaga-miniapp-api:staging`;
- build and push `ghcr.io/jlucky94/sharaga-miniapp-web:staging`;
- deploy to `/var/www/sharaga-miniapp-staging`;
- expose the web container on port `8091`.

## Expected VPS shape

The staging compose file is generated on the server and should resolve to:

- API image tag `staging`;
- WEB image tag `staging`;
- web host port `8091`;
- env vars loaded from the staging GitHub Environment secrets.

## Staging verification

After the workflow finishes:

```bash
cd /var/www/sharaga-miniapp-staging
docker compose ps
docker compose logs api --tail=100
curl -f http://localhost:8091
```

Then verify in the app:

- auth opens successfully;
- demo feed is visible and marked;
- one project contribution works;
- one Exam party can be assembled end to end.

## Manual refresh on the VPS

If you need to refresh staging without rebuilding locally:

```bash
cd /var/www/sharaga-miniapp-staging
docker compose pull
docker compose up -d
docker compose ps
```
