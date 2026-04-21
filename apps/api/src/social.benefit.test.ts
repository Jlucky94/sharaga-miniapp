import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from './app.js';
import { calculateTelegramHash } from './auth.js';
import { InMemoryAppStore } from './store.js';

const BOT_TOKEN = 'test-bot-token';

function buildInitData(userId = 42, username = 'user'): string {
  const user = JSON.stringify({ id: userId, first_name: 'User', username });
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

async function authenticateUser(app: ReturnType<typeof createTestApp>['app'], userId: number, archetype: 'botan' | 'sportsman' | 'partygoer') {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(userId) } });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { accessToken: string; user: { id: string } };
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${body.accessToken}` }, payload: { archetype } });
  return body;
}

async function unlockNotesProject(app: ReturnType<typeof createTestApp>['app'], store: InMemoryAppStore, clock: { now: Date }, accessToken: string) {
  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;
  for (let i = 0; i < 5; i++) {
    clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
    await app.inject({
      method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
      headers: { Authorization: `Bearer ${accessToken}` },
      payload: { requestId: `bb${i}bbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`, amount: 1 }
    });
  }
  return notes.id;
}

test('player B can claim benefit from an unlocked project', async () => {
  const { app, store, clock } = createTestApp();
  const userA = await authenticateUser(app, 1, 'botan');
  const userB = await authenticateUser(app, 2, 'sportsman');

  const projectId = await unlockNotesProject(app, store, clock, userA.accessToken);

  const res = await app.inject({
    method: 'POST', url: `/api/v1/projects/${projectId}/claim-benefit`,
    headers: { Authorization: `Bearer ${userB.accessToken}` }
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { profile: { softCurrency: number }; claim: { id: string } };
  assert.ok(body.claim.id);
  assert.ok(body.profile.softCurrency >= 2, 'claimant should receive soft currency');
  await app.close();
});

test('second claim by same player returns 409', async () => {
  const { app, store, clock } = createTestApp();
  const userA = await authenticateUser(app, 1, 'botan');
  const userB = await authenticateUser(app, 2, 'sportsman');
  const projectId = await unlockNotesProject(app, store, clock, userA.accessToken);

  await app.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/claim-benefit`, headers: { Authorization: `Bearer ${userB.accessToken}` } });
  const res = await app.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/claim-benefit`, headers: { Authorization: `Bearer ${userB.accessToken}` } });
  assert.equal(res.statusCode, 409);
  await app.close();
});

test('contributor cannot claim their own project benefit', async () => {
  const { app, store, clock } = createTestApp();
  const userA = await authenticateUser(app, 1, 'botan');
  const projectId = await unlockNotesProject(app, store, clock, userA.accessToken);

  const res = await app.inject({
    method: 'POST', url: `/api/v1/projects/${projectId}/claim-benefit`,
    headers: { Authorization: `Bearer ${userA.accessToken}` }
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test('cannot claim benefit from a not-yet-unlocked project', async () => {
  const { app, store } = createTestApp();
  const userA = await authenticateUser(app, 1, 'botan');
  const userB = await authenticateUser(app, 2, 'sportsman');
  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  const res = await app.inject({
    method: 'POST', url: `/api/v1/projects/${notes.id}/claim-benefit`,
    headers: { Authorization: `Bearer ${userB.accessToken}` }
  });
  assert.equal(res.statusCode, 403);
  void userA;
  await app.close();
});

test('benefit claim bumps contributor reputation', async () => {
  const { app, store, clock } = createTestApp();
  const userA = await authenticateUser(app, 1, 'botan');
  const userB = await authenticateUser(app, 2, 'sportsman');
  const projectId = await unlockNotesProject(app, store, clock, userA.accessToken);

  const profileBefore = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${userA.accessToken}` } });
  const repBefore = (profileBefore.json() as { profile: { reputation: number } }).profile.reputation;

  await app.inject({ method: 'POST', url: `/api/v1/projects/${projectId}/claim-benefit`, headers: { Authorization: `Bearer ${userB.accessToken}` } });

  const profileAfter = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${userA.accessToken}` } });
  const repAfter = (profileAfter.json() as { profile: { reputation: number } }).profile.reputation;

  assert.ok(repAfter > repBefore, 'contributor reputation should increase after benefit claim');
  await app.close();
});
