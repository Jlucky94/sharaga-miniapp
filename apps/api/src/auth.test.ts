import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from './app.js';
import { calculateTelegramHash, validateTelegramInitData } from './auth.js';

const BOT_TOKEN = 'test-bot-token';

function buildInitData(overrideHash?: string): string {
  const user = JSON.stringify({
    id: 42,
    first_name: 'Jane',
    username: 'jane42'
  });

  const authDate = `${Math.floor(Date.now() / 1000)}`;
  const entries: [string, string][] = [
    ['auth_date', authDate],
    ['query_id', 'AAHdF6IQAAAAAN0XohDhrOrc'],
    ['user', user]
  ];

  const dataCheckString = entries
    .slice()
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const hash = overrideHash ?? calculateTelegramHash(dataCheckString, BOT_TOKEN);

  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.set(key, value);
  }
  params.set('hash', hash);

  return params.toString();
}

function createTestApp() {
  return buildApp({
    telegramBotToken: BOT_TOKEN,
    jwtSecret: 'jwt-secret',
    jwtExpiresIn: '1h'
  });
}

async function authenticate(app: ReturnType<typeof createTestApp>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/telegram',
    payload: { initData: buildInitData() }
  });

  assert.equal(response.statusCode, 200);
  return response.json() as { accessToken: string; user: { id: string; telegramId: number; firstName: string } };
}

test('valid initData signature passes validation', () => {
  const initData = buildInitData();
  const validated = validateTelegramInitData(initData, BOT_TOKEN);

  assert.equal(validated.user.id, 42);
  assert.equal(validated.user.first_name, 'Jane');
});

test('invalid signature returns 401 from auth endpoint', async () => {
  const app = createTestApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/telegram',
    payload: { initData: buildInitData('not-valid-hash') }
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    code: 'INVALID_SIGNATURE',
    message: 'Telegram initData signature is invalid'
  });

  await app.close();
});

test('me endpoint without token returns 401', async () => {
  const app = createTestApp();

  const response = await app.inject({ method: 'GET', url: '/api/v1/me' });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test('me endpoint returns authenticated Telegram user', async () => {
  const app = createTestApp();
  const auth = await authenticate(app);

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), auth.user);

  await app.close();
});
