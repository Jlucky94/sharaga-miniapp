import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from './app.js';
import { calculateTelegramHash } from './auth.js';
import { InMemoryAppStore } from './store.js';

const BOT_TOKEN = 'test-bot-token';

function buildInitData(userId: number, firstName: string): string {
  const user = JSON.stringify({ id: userId, first_name: firstName, username: `user${userId}` });
  const authDate = `${Math.floor(Date.now() / 1000)}`;
  const entries: [string, string][] = [['auth_date', authDate], ['query_id', 'q'], ['user', user]];
  const dataCheckString = entries.slice().sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const hash = calculateTelegramHash(dataCheckString, BOT_TOKEN);
  const params = new URLSearchParams();
  for (const [k, v] of entries) params.set(k, v);
  params.set('hash', hash);
  return params.toString();
}

async function authAs(app: ReturnType<typeof buildApp>, id: number, firstName: string, archetype: 'botan' | 'sportsman' | 'partygoer') {
  const authRes = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(id, firstName) } });
  const token = (authRes.json() as { accessToken: string }).accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${token}` }, payload: { archetype } });
  return token;
}

test('three-account exam loop: queue, ready, autostart, rewards and feed', async () => {
  const clock = { now: new Date('2026-04-23T12:00:00.000Z') };
  const store = new InMemoryAppStore();
  const app = buildApp(
    { telegramBotToken: BOT_TOKEN, jwtSecret: 'jwt-secret', jwtExpiresIn: '1h', databaseUrl: 'postgresql://unused' },
    { store, now: () => clock.now }
  );

  const tokenA = await authAs(app, 100, 'Alice', 'botan');
  const tokenB = await authAs(app, 200, 'Bob', 'sportsman');
  const tokenC = await authAs(app, 300, 'Cora', 'partygoer');

  const queueA = await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${tokenA}` }, payload: { capacity: 3 } });
  const partyId = (queueA.json() as { party: { id: string } }).party.id;
  await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${tokenB}` }, payload: { capacity: 3 } });
  await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${tokenC}` }, payload: { capacity: 3 } });

  const readyA = await app.inject({ method: 'POST', url: `/api/v1/parties/${partyId}/ready`, headers: { Authorization: `Bearer ${tokenA}` }, payload: { ready: true } });
  assert.equal(readyA.statusCode, 200);
  assert.equal((readyA.json() as { run: null }).run, null);

  const readyB = await app.inject({ method: 'POST', url: `/api/v1/parties/${partyId}/ready`, headers: { Authorization: `Bearer ${tokenB}` }, payload: { ready: true } });
  assert.equal((readyB.json() as { run: null }).run, null);

  clock.now = new Date('2026-04-23T12:01:00.000Z');
  const readyC = await app.inject({ method: 'POST', url: `/api/v1/parties/${partyId}/ready`, headers: { Authorization: `Bearer ${tokenC}` }, payload: { ready: true } });
  assert.equal(readyC.statusCode, 200);
  const run = (readyC.json() as { run: { outcome: string; rewards: Array<{ profileXp: number }> }; party: null }).run;
  assert.ok(run);
  assert.equal((readyC.json() as { party: null }).party, null);
  assert.ok(['success', 'partial_failure'].includes(run.outcome));
  assert.equal(run.rewards.length, 3);

  const profileA = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${tokenA}` } });
  assert.ok((profileA.json() as { profile: { profileXp: number } }).profile.profileXp > 0);

  const examState = await app.inject({ method: 'GET', url: '/api/v1/exam', headers: { Authorization: `Bearer ${tokenA}` } });
  assert.equal((examState.json() as { latestRun: { partyId: string } }).latestRun.partyId, partyId);

  const feed = await app.inject({ method: 'GET', url: '/api/v1/feed', headers: { Authorization: `Bearer ${tokenA}` } });
  const examItem = (feed.json() as { items: Array<{ kind: string; partyId: string }> }).items.find((item) => item.kind === 'exam_result');
  assert.ok(examItem);
  assert.equal(examItem?.partyId, partyId);

  await app.close();
});
