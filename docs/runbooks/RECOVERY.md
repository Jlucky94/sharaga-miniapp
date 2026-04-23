# Recovery And Rollback

Use this when a deployment breaks the product path or a migration/seed step leaves staging or production in a bad state.

## Before touching recovery

- identify whether the issue is app image, migration, seed, or data corruption;
- stop any repeated manual retries that could duplicate writes;
- note the currently running image tags and the timestamp of the latest good DB dump.

## Fast image rollback

If the schema is unchanged and the issue is in API/web code:

1. SSH to the target host.
2. Open the deploy directory:

```bash
cd /var/www/sharaga-miniapp
```

For staging use `/var/www/sharaga-miniapp-staging`.

3. Edit `docker-compose.yml` and point `api`/`web` back to the previous known-good GHCR tags.
4. Restart:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

5. Verify `/api/v1/health` and the first-value path before reopening traffic.

## Database restore from dump

If the problem is data corruption or a bad migration/seed:

1. Stop app containers:

```bash
docker compose stop api web
```

2. Restore PostgreSQL from the latest verified dump:

```bash
psql "$DATABASE_URL" < /path/to/verified-dump.sql
```

3. Re-apply the checked-in schema:

```bash
pnpm --filter @sharaga/api prisma:migrate:deploy
```

4. Re-run the idempotent seed:

```bash
pnpm --filter @sharaga/api prisma:seed
```

5. Restart the containers:

```bash
docker compose up -d
docker compose ps
```

## When to re-run seed

Safe to re-run:

- after DB restore;
- after migrating a clean/staging DB;
- when verifying alpha bootstrap on a new environment.

Stop and investigate first if:

- duplicate demo actors/events appear;
- project progress or unlock state no longer matches expected seed state;
- bot notification rows multiply across a plain seed re-run.

## Post-recovery checks

- `/api/v1/health` returns `ok`;
- one fresh user reaches first value;
- feed shows `Демо` markers;
- one social thanks path works;
- one Exam result appears once;
- `bot_notifications` does not show duplicate `dedupeKey` rows.
