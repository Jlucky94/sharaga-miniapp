import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from './app.js';
import { calculateTelegramHash, validateTelegramInitData } from './auth.js';
import { ENERGY_INTERVAL_MS, MAX_ENERGY } from './profile.js';
import { InMemoryAppStore } from './store.js';

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
  const store = new InMemoryAppStore();
  const clock = {
    now: new Date('2026-04-21T00:00:00.000Z')
  };

  const app = buildApp(
    {
      telegramBotToken: BOT_TOKEN,
      jwtSecret: 'jwt-secret',
      jwtExpiresIn: '1h',
      databaseUrl: 'postgresql://unused-for-tests'
    },
    {
      store,
      now: () => clock.now
    }
  );

  return { app, store, clock };
}

async function authenticate(app: ReturnType<typeof createTestApp>['app']) {
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
  const { app } = createTestApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/telegram',
    payload: { initData: buildInitData('not-valid-hash') }
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    code: 'INVALID_SIGNATURE',
    message: 'Подпись Telegram initData недействительна'
  });

  await app.close();
});

test('me endpoint without token returns 401', async () => {
  const { app } = createTestApp();

  const response = await app.inject({ method: 'GET', url: '/api/v1/me' });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test('me endpoint returns authenticated Telegram user', async () => {
  const { app } = createTestApp();
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

test('first login creates a profile and repeated login reuses it', async () => {
  const { app } = createTestApp();

  const firstAuth = await authenticate(app);
  const secondAuth = await authenticate(app);

  assert.equal(firstAuth.user.id, secondAuth.user.id);

  const profileResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/profile',
    headers: {
      Authorization: `Bearer ${firstAuth.accessToken}`
    }
  });

  assert.equal(profileResponse.statusCode, 200);
  assert.equal(profileResponse.json().profile.energy, MAX_ENERGY);
  assert.equal(profileResponse.json().writeAccessGranted, false);

  await app.close();
});

test('archetype can only be selected once', async () => {
  const { app, store } = createTestApp();
  const auth = await authenticate(app);

  const firstSelection = await app.inject({
    method: 'POST',
    url: '/api/v1/class/select',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { archetype: 'botan' }
  });

  assert.equal(firstSelection.statusCode, 200);
  assert.equal(firstSelection.json().profile.archetype, 'botan');

  const secondSelection = await app.inject({
    method: 'POST',
    url: '/api/v1/class/select',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { archetype: 'partygoer' }
  });

  assert.equal(secondSelection.statusCode, 409);
  assert.deepEqual(secondSelection.json(), {
    code: 'ARCHETYPE_ALREADY_SELECTED',
    message: 'Роль уже выбрана'
  });

  const events = await store.listEvents(auth.user.id);
  assert.equal(events.filter((event) => event.eventType === 'archetype.selected').length, 1);

  await app.close();
});

test('actions require an archetype before use', async () => {
  const { app } = createTestApp();
  const auth = await authenticate(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/actions/perform',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { actionId: 'study_notes' }
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    code: 'ARCHETYPE_REQUIRED',
    message: 'Сначала выбери роль'
  });

  await app.close();
});

test('profile action grants expected rewards and writes one event', async () => {
  const { app, store } = createTestApp();
  const auth = await authenticate(app);

  await app.inject({
    method: 'POST',
    url: '/api/v1/class/select',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { archetype: 'sportsman' }
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/actions/perform',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { actionId: 'train_hard' }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().result.rewards, {
    profileXp: 10,
    archetypeXp: 6,
    softCurrency: 1
  });
  assert.equal(response.json().profile.energy, 2);
  assert.equal(response.json().profile.profileXp, 10);
  assert.equal(response.json().profile.archetypeXp, 6);

  const events = await store.listEvents(auth.user.id);
  assert.equal(events.filter((event) => event.eventType === 'action.performed').length, 1);

  await app.close();
});

test('full first-value loop survives profile reload and repeated login', async () => {
  const { app } = createTestApp();
  const firstAuth = await authenticate(app);

  const selectResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/class/select',
    headers: {
      Authorization: `Bearer ${firstAuth.accessToken}`
    },
    payload: { archetype: 'botan' }
  });

  assert.equal(selectResponse.statusCode, 200);
  assert.equal(selectResponse.json().profile.archetype, 'botan');

  const actionResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/actions/perform',
    headers: {
      Authorization: `Bearer ${firstAuth.accessToken}`
    },
    payload: { actionId: 'study_notes' }
  });

  assert.equal(actionResponse.statusCode, 200);
  assert.equal(actionResponse.json().profile.profileXp, 10);
  assert.equal(actionResponse.json().profile.archetypeXp, 6);
  assert.equal(actionResponse.json().profile.softCurrency, 1);
  assert.equal(actionResponse.json().profile.energy, 2);

  const reloadedProfile = await app.inject({
    method: 'GET',
    url: '/api/v1/profile',
    headers: {
      Authorization: `Bearer ${firstAuth.accessToken}`
    }
  });

  assert.equal(reloadedProfile.statusCode, 200);
  assert.equal(reloadedProfile.json().profile.archetype, 'botan');
  assert.equal(reloadedProfile.json().profile.profileXp, 10);
  assert.equal(reloadedProfile.json().profile.archetypeXp, 6);
  assert.equal(reloadedProfile.json().profile.softCurrency, 1);
  assert.equal(reloadedProfile.json().profile.energy, 2);
  assert.equal(reloadedProfile.json().writeAccessGranted, false);

  const secondAuth = await authenticate(app);
  assert.equal(secondAuth.user.id, firstAuth.user.id);

  const reloginProfile = await app.inject({
    method: 'GET',
    url: '/api/v1/profile',
    headers: {
      Authorization: `Bearer ${secondAuth.accessToken}`
    }
  });

  assert.equal(reloginProfile.statusCode, 200);
  assert.equal(reloginProfile.json().profile.archetype, 'botan');
  assert.equal(reloginProfile.json().profile.profileXp, 10);
  assert.equal(reloginProfile.json().profile.archetypeXp, 6);
  assert.equal(reloginProfile.json().profile.softCurrency, 1);
  assert.equal(reloginProfile.json().profile.energy, 2);
  assert.equal(reloginProfile.json().writeAccessGranted, false);

  await app.close();
});

test('neutral action gives neutral archetype progress', async () => {
  const { app } = createTestApp();
  const auth = await authenticate(app);

  await app.inject({
    method: 'POST',
    url: '/api/v1/class/select',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { archetype: 'partygoer' }
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/actions/perform',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { actionId: 'help_classmate' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().result.rewards.archetypeXp, 4);

  await app.close();
});

test('non-profile thematic action gives reduced archetype progress', async () => {
  const { app } = createTestApp();
  const auth = await authenticate(app);

  await app.inject({
    method: 'POST',
    url: '/api/v1/class/select',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { archetype: 'botan' }
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/actions/perform',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { actionId: 'spark_the_campus' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().result.rewards.archetypeXp, 2);

  await app.close();
});

test('insufficient energy blocks actions until regen catches up', async () => {
  const { app, clock } = createTestApp();
  const auth = await authenticate(app);

  await app.inject({
    method: 'POST',
    url: '/api/v1/class/select',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { archetype: 'botan' }
  });

  for (let index = 0; index < MAX_ENERGY; index += 1) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions/perform',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`
      },
      payload: { actionId: 'study_notes' }
    });

    assert.equal(response.statusCode, 200);
  }

  const depletedResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/actions/perform',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    },
    payload: { actionId: 'study_notes' }
  });

  assert.equal(depletedResponse.statusCode, 409);
  assert.deepEqual(depletedResponse.json(), {
    code: 'INSUFFICIENT_ENERGY',
    message: 'На это действие не хватает энергии'
  });

  clock.now = new Date(clock.now.getTime() + ENERGY_INTERVAL_MS);

  const profileResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/profile',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`
    }
  });

  assert.equal(profileResponse.statusCode, 200);
  assert.equal(profileResponse.json().profile.energy, 1);

  await app.close();
});
