import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from './app.js';
import { calculateTelegramHash } from './auth.js';
import { InMemoryAppStore } from './store.js';

const BOT_TOKEN = 'test-bot-token';

function buildInitData(userId = 42, username = 'jane42'): string {
  const user = JSON.stringify({ id: userId, first_name: 'Jane', username });
  const authDate = `${Math.floor(Date.now() / 1000)}`;
  const entries: [string, string][] = [
    ['auth_date', authDate],
    ['query_id', 'AAHdF6IQAAAAAN0XohDhrOrc'],
    ['user', user]
  ];
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

async function authenticate(app: ReturnType<typeof createTestApp>['app'], userId = 42) {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(userId) } });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { accessToken: string; user: { id: string } };
  // Select archetype
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${body.accessToken}` }, payload: { archetype: 'botan' } });
  return body;
}

test('contribute happy path returns contribution and updated project', async () => {
  const { app, store } = createTestApp();
  const auth = await authenticate(app);
  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${notes.id}/contribute`,
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    payload: { requestId: '11111111-1111-1111-1111-111111111111', amount: 1 }
  });

  assert.equal(res.statusCode, 200);
  const body = res.json() as { project: { progress: number }; contribution: { id: string }; unlocked: boolean };
  assert.equal(body.project.progress, 1);
  assert.ok(body.contribution.id);
  assert.equal(body.unlocked, false);
  await app.close();
});

test('repeated requestId returns same contribution without extra events', async () => {
  const { app, store } = createTestApp();
  const auth = await authenticate(app);
  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;
  const requestId = '22222222-2222-2222-2222-222222222222';

  const res1 = await app.inject({
    method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    payload: { requestId, amount: 1 }
  });
  assert.equal(res1.statusCode, 200);

  const eventsBefore = await store.listEvents(auth.user.id);
  const contribEventsBefore = eventsBefore.filter((e) => e.eventType === 'project.contributed').length;

  const res2 = await app.inject({
    method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    payload: { requestId, amount: 1 }
  });
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.json().contribution.id, res1.json().contribution.id);

  const eventsAfter = await store.listEvents(auth.user.id);
  const contribEventsAfter = eventsAfter.filter((e) => e.eventType === 'project.contributed').length;
  assert.equal(contribEventsAfter, contribEventsBefore, 'no new events on idempotent replay');
  await app.close();
});

test('contribute fails when energy is empty', async () => {
  const { app, store } = createTestApp();
  const auth = await authenticate(app);
  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  // Drain all 3 energy units
  for (let i = 0; i < 3; i++) {
    await app.inject({ method: 'POST', url: `/api/v1/actions/perform`, headers: { Authorization: `Bearer ${auth.accessToken}` }, payload: { actionId: 'study_notes' } });
  }

  const res = await app.inject({
    method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    payload: { requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', amount: 1 }
  });
  assert.equal(res.statusCode, 422);
  await app.close();
});

test('contributing 5 times unlocks the notes project', async () => {
  const { app, store, clock } = createTestApp();
  const auth = await authenticate(app);
  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  for (let i = 0; i < 5; i++) {
    // Restore energy between contributions
    clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
    const res = await app.inject({
      method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      payload: { requestId: `33333333-3333-3333-3333-33333333333${i}`, amount: 1 }
    });
    assert.equal(res.statusCode, 200, `contribution ${i + 1} failed`);
  }

  const updatedProject = await store.getProjectById(notes.id);
  assert.ok(updatedProject?.unlockedAt !== null, 'project should be unlocked');

  const events = await store.listEvents(auth.user.id);
  const unlockEvents = events.filter((e) => e.eventType === 'project.unlocked');
  assert.equal(unlockEvents.length, 1, 'exactly one project.unlocked event');
  await app.close();
});

test('contributing after unlock is rejected with 409', async () => {
  const { app, store, clock } = createTestApp();
  const auth = await authenticate(app);
  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  for (let i = 0; i < 5; i++) {
    clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
    await app.inject({
      method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      payload: { requestId: `44444444-4444-4444-4444-44444444444${i}`, amount: 1 }
    });
  }

  clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
  const res = await app.inject({
    method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    payload: { requestId: '55555555-5555-5555-5555-555555555555', amount: 1 }
  });
  assert.equal(res.statusCode, 409);
  await app.close();
});
