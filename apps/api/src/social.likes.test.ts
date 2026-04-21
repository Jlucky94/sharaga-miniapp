import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from './app.js';
import { calculateTelegramHash } from './auth.js';
import { InMemoryAppStore } from './store.js';

const BOT_TOKEN = 'test-bot-token';

function buildInitData(userId = 42): string {
  const user = JSON.stringify({ id: userId, first_name: 'User', username: `user${userId}` });
  const authDate = `${Math.floor(Date.now() / 1000)}`;
  const entries: [string, string][] = [['auth_date', authDate], ['query_id', 'q'], ['user', user]];
  const dataCheckString = entries.slice().sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const hash = calculateTelegramHash(dataCheckString, BOT_TOKEN);
  const params = new URLSearchParams();
  for (const [k, v] of entries) params.set(k, v);
  params.set('hash', hash);
  return params.toString();
}

function createTestApp() {
  const store = new InMemoryAppStore();
  const clock = { now: new Date('2026-04-22T10:00:00.000Z') };
  const app = buildApp(
    { telegramBotToken: BOT_TOKEN, jwtSecret: 'jwt-secret', jwtExpiresIn: '1h', databaseUrl: 'postgresql://unused' },
    { store, now: () => clock.now }
  );
  return { app, store, clock };
}

async function setup(app: ReturnType<typeof createTestApp>['app'], store: InMemoryAppStore, clock: { now: Date }) {
  const authA = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(1) } });
  const tokenA = (authA.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenA}` }, payload: { archetype: 'botan' } });

  const authB = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(2) } });
  const tokenB = (authB.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenB}` }, payload: { archetype: 'sportsman' } });

  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  // A contributes
  const contribRes = await app.inject({
    method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
    headers: { Authorization: `Bearer ${tokenA}` },
    payload: { requestId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', amount: 1 }
  });
  const contributionId = (contribRes.json() as { contribution: { id: string } }).contribution.id;

  void clock;
  return { tokenA, tokenB, contributionId, userAId: (authA.json() as { user: { id: string } }).user.id };
}

test('player B can like player A contribution', async () => {
  const { app, store, clock } = createTestApp();
  const { tokenB, contributionId } = await setup(app, store, clock);

  const res = await app.inject({
    method: 'POST', url: `/api/v1/contributions/${contributionId}/like`,
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.equal(res.statusCode, 200);
  const like = (res.json() as { like: { id: string; contributionId: string } }).like;
  assert.equal(like.contributionId, contributionId);
  await app.close();
});

test('duplicate like returns 409', async () => {
  const { app, store, clock } = createTestApp();
  const { tokenB, contributionId } = await setup(app, store, clock);

  await app.inject({ method: 'POST', url: `/api/v1/contributions/${contributionId}/like`, headers: { Authorization: `Bearer ${tokenB}` } });
  const res = await app.inject({ method: 'POST', url: `/api/v1/contributions/${contributionId}/like`, headers: { Authorization: `Bearer ${tokenB}` } });
  assert.equal(res.statusCode, 409);
  await app.close();
});

test('self-like returns 400', async () => {
  const { app, store, clock } = createTestApp();
  const { tokenA, contributionId } = await setup(app, store, clock);

  const res = await app.inject({
    method: 'POST', url: `/api/v1/contributions/${contributionId}/like`,
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test('like increments contributor reputation by 1', async () => {
  const { app, store, clock } = createTestApp();
  const { tokenA, tokenB, contributionId } = await setup(app, store, clock);

  const before = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${tokenA}` } });
  const repBefore = (before.json() as { profile: { reputation: number } }).profile.reputation;

  await app.inject({ method: 'POST', url: `/api/v1/contributions/${contributionId}/like`, headers: { Authorization: `Bearer ${tokenB}` } });

  const after = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${tokenA}` } });
  const repAfter = (after.json() as { profile: { reputation: number } }).profile.reputation;

  assert.equal(repAfter, repBefore + 1);
  await app.close();
});
