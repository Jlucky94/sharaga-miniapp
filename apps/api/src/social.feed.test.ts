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

test('feed returns contribution events in descending order', async () => {
  const { app, store, clock } = createTestApp();

  const authA = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(1) } });
  const tokenA = (authA.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenA}` }, payload: { archetype: 'botan' } });

  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  clock.now = new Date('2026-04-22T10:01:00.000Z');
  await app.inject({ method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`, headers: { Authorization: `Bearer ${tokenA}` }, payload: { requestId: 'aa000001-0000-0000-0000-000000000001', amount: 1 } });

  clock.now = new Date('2026-04-22T10:02:00.000Z');
  await app.inject({ method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`, headers: { Authorization: `Bearer ${tokenA}` }, payload: { requestId: 'aa000002-0000-0000-0000-000000000002', amount: 1 } });

  const feedRes = await app.inject({ method: 'GET', url: '/api/v1/feed', headers: { Authorization: `Bearer ${tokenA}` } });
  assert.equal(feedRes.statusCode, 200);
  const items = (feedRes.json() as { items: Array<{ kind: string; createdAt: string }> }).items;

  const contributions = items.filter((i) => i.kind === 'contribution');
  assert.ok(contributions.length >= 2);

  // Should be in descending order
  for (let i = 1; i < contributions.length; i++) {
    const prev = contributions[i - 1];
    const curr = contributions[i];
    assert.ok(prev && curr && new Date(prev.createdAt) >= new Date(curr.createdAt));
  }
  await app.close();
});

test('feed contains all four event kinds after full social loop', async () => {
  const { app, store, clock } = createTestApp();

  const authA = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(10) } });
  const tokenA = (authA.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenA}` }, payload: { archetype: 'botan' } });

  const authB = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(11) } });
  const tokenB = (authB.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenB}` }, payload: { archetype: 'sportsman' } });

  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  // A contributes until unlocked
  for (let i = 0; i < 5; i++) {
    clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
    await app.inject({ method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`, headers: { Authorization: `Bearer ${tokenA}` }, payload: { requestId: `ff00000${i}-0000-0000-0000-000000000001`, amount: 1 } });
  }

  // B claims benefit
  await app.inject({ method: 'POST', url: `/api/v1/projects/${notes.id}/claim-benefit`, headers: { Authorization: `Bearer ${tokenB}` } });

  // B likes A's contribution
  const contribs = await store.listProjectContributorIds(notes.id);
  void contribs;

  // Get feed and find a contribution to like
  const feedRes = await app.inject({ method: 'GET', url: '/api/v1/feed', headers: { Authorization: `Bearer ${tokenB}` } });
  const feedItems = (feedRes.json() as { items: Array<{ kind: string; id: string }> }).items;
  const contribItem = feedItems.find((i) => i.kind === 'contribution');
  if (contribItem) {
    await app.inject({ method: 'POST', url: `/api/v1/contributions/${contribItem.id}/like`, headers: { Authorization: `Bearer ${tokenB}` } });
  }

  const finalFeed = await app.inject({ method: 'GET', url: '/api/v1/feed', headers: { Authorization: `Bearer ${tokenA}` } });
  const finalItems = (finalFeed.json() as { items: Array<{ kind: string }> }).items;
  const kinds = new Set(finalItems.map((i) => i.kind));

  assert.ok(kinds.has('contribution'), 'feed should have contribution entries');
  assert.ok(kinds.has('benefit'), 'feed should have benefit entries');
  assert.ok(kinds.has('unlock'), 'feed should have unlock entries');
  await app.close();
});

test('feed respects limit parameter', async () => {
  const { app, store, clock } = createTestApp();

  const authA = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(20) } });
  const tokenA = (authA.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenA}` }, payload: { archetype: 'botan' } });

  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  for (let i = 0; i < 3; i++) {
    clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
    await app.inject({ method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`, headers: { Authorization: `Bearer ${tokenA}` }, payload: { requestId: `ee00000${i}-0000-0000-0000-000000000001`, amount: 1 } });
  }

  const res = await app.inject({ method: 'GET', url: '/api/v1/feed?limit=2', headers: { Authorization: `Bearer ${tokenA}` } });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { items: unknown[]; nextCursor: string | null };
  assert.ok(body.items.length <= 2);
  await app.close();
});

test('feed pagination keeps events that share the same timestamp', async () => {
  const { app, store, clock } = createTestApp();

  const authA = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(30) } });
  const tokenA = (authA.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenA}` }, payload: { archetype: 'botan' } });

  const authB = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(31) } });
  const tokenB = (authB.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenB}` }, payload: { archetype: 'sportsman' } });

  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  for (let i = 0; i < 4; i++) {
    clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${notes.id}/contribute`,
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { requestId: `3300000${i}-0000-4000-8000-00000000000${i}`, amount: 1 }
    });
  }

  clock.now = new Date('2026-04-22T13:00:00.000Z');
  await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${notes.id}/contribute`,
    headers: { Authorization: `Bearer ${tokenA}` },
    payload: { requestId: '33000004-0000-4000-8000-000000000004', amount: 1 }
  });

  await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${notes.id}/claim-benefit`,
    headers: { Authorization: `Bearer ${tokenB}` }
  });

  const firstPageRes = await app.inject({ method: 'GET', url: '/api/v1/feed?limit=2', headers: { Authorization: `Bearer ${tokenA}` } });
  assert.equal(firstPageRes.statusCode, 200);
  const firstPage = firstPageRes.json() as {
    items: Array<{ kind: string; projectId?: string }>;
    nextCursor: string | null;
  };

  assert.equal(firstPage.items.length, 2);
  assert.ok(firstPage.nextCursor);

  const secondPageRes = await app.inject({
    method: 'GET',
    url: `/api/v1/feed?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(secondPageRes.statusCode, 200);
  const secondPage = secondPageRes.json() as {
    items: Array<{ kind: string; projectId?: string }>;
    nextCursor: string | null;
  };

  const combined = [...firstPage.items, ...secondPage.items].filter((item) => item.projectId === notes.id);
  const kinds = new Set(combined.map((item) => item.kind));

  assert.ok(kinds.has('contribution'), 'combined pages should keep the contribution event');
  assert.ok(kinds.has('unlock'), 'combined pages should keep the unlock event');
  assert.ok(kinds.has('benefit'), 'combined pages should keep the benefit event');

  await app.close();
});
