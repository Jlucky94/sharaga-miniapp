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

test('queue joins users into one shared party and flips to ready_check when full', async () => {
  const store = new InMemoryAppStore();
  const app = buildApp(
    { telegramBotToken: BOT_TOKEN, jwtSecret: 'jwt-secret', jwtExpiresIn: '1h', databaseUrl: 'postgresql://unused' },
    { store, now: () => new Date('2026-04-23T10:00:00.000Z') }
  );

  const tokenA = await authAs(app, 100, 'Alice', 'botan');
  const tokenB = await authAs(app, 200, 'Bob', 'sportsman');
  const tokenC = await authAs(app, 300, 'Cora', 'partygoer');

  const queueA = await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${tokenA}` }, payload: { capacity: 3 } });
  const partyId = (queueA.json() as { party: { id: string } }).party.id;
  assert.equal(queueA.statusCode, 200);

  const queueB = await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${tokenB}` }, payload: { capacity: 3 } });
  assert.equal((queueB.json() as { party: { id: string } }).party.id, partyId);

  const queueC = await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${tokenC}` }, payload: { capacity: 3 } });
  assert.equal((queueC.json() as { party: { id: string; status: string; memberCount: number } }).party.id, partyId);
  assert.equal((queueC.json() as { party: { status: string } }).party.status, 'ready_check');
  assert.equal((queueC.json() as { party: { memberCount: number } }).party.memberCount, 3);

  await app.close();
});
