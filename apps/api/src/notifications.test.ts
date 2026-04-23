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
  const dataCheckString = entries
    .slice()
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const hash = calculateTelegramHash(dataCheckString, BOT_TOKEN);
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.set(key, value);
  }
  params.set('hash', hash);
  return params.toString();
}

function createTestApp(
  sendTelegramMessage: (args: { chatId: number; text: string }) => Promise<void> = async () => {}
) {
  const store = new InMemoryAppStore();
  const clock = { now: new Date('2026-04-24T09:00:00.000Z') };
  const app = buildApp(
    {
      telegramBotToken: BOT_TOKEN,
      jwtSecret: 'jwt-secret',
      jwtExpiresIn: '1h',
      databaseUrl: 'postgresql://unused'
    },
    {
      store,
      now: () => clock.now,
      sendTelegramMessage
    }
  );

  return { app, store, clock };
}

async function authAs(
  app: ReturnType<typeof buildApp>,
  userId: number,
  firstName: string,
  archetype?: 'botan' | 'sportsman' | 'partygoer'
) {
  const authResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/telegram',
    payload: { initData: buildInitData(userId, firstName) }
  });
  assert.equal(authResponse.statusCode, 200);

  const auth = authResponse.json() as { accessToken: string; user: { id: string } };

  if (archetype) {
    const selectResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/class/select',
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      payload: { archetype }
    });
    assert.equal(selectResponse.statusCode, 200);
  }

  return {
    accessToken: auth.accessToken,
    userId: auth.user.id
  };
}

async function grantWriteAccess(app: ReturnType<typeof buildApp>, accessToken: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/notifications/write-access',
    headers: { Authorization: `Bearer ${accessToken}` },
    payload: { granted: true }
  });

  assert.equal(response.statusCode, 200);
  assert.equal((response.json() as { writeAccessGranted: boolean }).writeAccessGranted, true);
}

test('write access grant persists and confirmation notification stays deduped', async () => {
  const sent: Array<{ chatId: number; text: string }> = [];
  const { app, store } = createTestApp(async (message) => {
    sent.push(message);
  });

  const alice = await authAs(app, 5001, 'Alice');

  await grantWriteAccess(app, alice.accessToken);
  await grantWriteAccess(app, alice.accessToken);

  const profileResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/profile',
    headers: { Authorization: `Bearer ${alice.accessToken}` }
  });
  assert.equal(profileResponse.statusCode, 200);
  assert.equal((profileResponse.json() as { writeAccessGranted: boolean }).writeAccessGranted, true);

  const notifications = await store.listBotNotifications(alice.userId);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.kind, 'write_access_confirmed');
  assert.equal(notifications[0]?.status, 'sent');
  assert.equal(sent.length, 1);

  await app.close();
});

test('telegram send failure does not break benefit-claim business response', async () => {
  let sendCount = 0;
  const { app, store, clock } = createTestApp(async () => {
    sendCount += 1;
    if (sendCount >= 2) {
      throw new Error('telegram unavailable');
    }
  });

  const alice = await authAs(app, 5101, 'Alice', 'botan');
  const bob = await authAs(app, 5102, 'Bob', 'sportsman');
  await grantWriteAccess(app, alice.accessToken);

  const projects = await store.listProjects();
  const notes = projects.find((project) => project.kind === 'notes');
  assert.ok(notes);

  for (let index = 0; index < 5; index += 1) {
    clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/projects/${notes!.id}/contribute`,
          headers: { Authorization: `Bearer ${alice.accessToken}` },
          payload: { requestId: `9100000${index}-0000-4000-8000-00000000000${index}`, amount: 1 }
        })
      ).statusCode,
      200
    );
  }

  const claimResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${notes!.id}/claim-benefit`,
    headers: { Authorization: `Bearer ${bob.accessToken}` }
  });

  assert.equal(claimResponse.statusCode, 200);
  const notifications = (await store.listBotNotifications(alice.userId)).filter(
    (notification) => notification.kind === 'social_payoff'
  );
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.status, 'failed');

  await app.close();
});

test('duplicate like does not create duplicate social notifications', async () => {
  const { app, store } = createTestApp();

  const alice = await authAs(app, 5201, 'Alice', 'botan');
  const bob = await authAs(app, 5202, 'Bob', 'sportsman');
  await grantWriteAccess(app, alice.accessToken);

  const projects = await store.listProjects();
  const notes = projects.find((project) => project.kind === 'notes');
  assert.ok(notes);

  const contributeResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${notes!.id}/contribute`,
    headers: { Authorization: `Bearer ${alice.accessToken}` },
    payload: { requestId: '92000000-0000-4000-8000-000000000001', amount: 1 }
  });
  assert.equal(contributeResponse.statusCode, 200);

  const feedResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/feed',
    headers: { Authorization: `Bearer ${bob.accessToken}` }
  });
  const contributionItem = (feedResponse.json() as { items: Array<{ kind: string; id: string }> }).items.find(
    (item) => item.kind === 'contribution'
  );
  assert.ok(contributionItem);

  const firstLike = await app.inject({
    method: 'POST',
    url: `/api/v1/contributions/${contributionItem!.id}/like`,
    headers: { Authorization: `Bearer ${bob.accessToken}` }
  });
  assert.equal(firstLike.statusCode, 200);

  const secondLike = await app.inject({
    method: 'POST',
    url: `/api/v1/contributions/${contributionItem!.id}/like`,
    headers: { Authorization: `Bearer ${bob.accessToken}` }
  });
  assert.equal(secondLike.statusCode, 409);

  const notifications = (await store.listBotNotifications(alice.userId)).filter(
    (notification) => notification.kind === 'social_payoff'
  );
  assert.equal(notifications.length, 1);

  await app.close();
});

test('replayed final ready keeps one exam-result notification per user', async () => {
  const { app, store, clock } = createTestApp();

  const alice = await authAs(app, 5301, 'Alice', 'botan');
  const bob = await authAs(app, 5302, 'Bob', 'sportsman');
  const cora = await authAs(app, 5303, 'Cora', 'partygoer');

  await grantWriteAccess(app, alice.accessToken);
  await grantWriteAccess(app, bob.accessToken);
  await grantWriteAccess(app, cora.accessToken);

  const queueAlice = await app.inject({
    method: 'POST',
    url: '/api/v1/parties/queue',
    headers: { Authorization: `Bearer ${alice.accessToken}` },
    payload: { capacity: 3 }
  });
  const partyId = (queueAlice.json() as { party: { id: string } }).party.id;

  await app.inject({
    method: 'POST',
    url: '/api/v1/parties/queue',
    headers: { Authorization: `Bearer ${bob.accessToken}` },
    payload: { capacity: 3 }
  });
  await app.inject({
    method: 'POST',
    url: '/api/v1/parties/queue',
    headers: { Authorization: `Bearer ${cora.accessToken}` },
    payload: { capacity: 3 }
  });

  await app.inject({
    method: 'POST',
    url: `/api/v1/parties/${partyId}/ready`,
    headers: { Authorization: `Bearer ${alice.accessToken}` },
    payload: { ready: true }
  });
  await app.inject({
    method: 'POST',
    url: `/api/v1/parties/${partyId}/ready`,
    headers: { Authorization: `Bearer ${bob.accessToken}` },
    payload: { ready: true }
  });

  clock.now = new Date(clock.now.getTime() + 60_000);
  const finalReady = await app.inject({
    method: 'POST',
    url: `/api/v1/parties/${partyId}/ready`,
    headers: { Authorization: `Bearer ${cora.accessToken}` },
    payload: { ready: true }
  });
  assert.equal(finalReady.statusCode, 200);

  const replayReady = await app.inject({
    method: 'POST',
    url: `/api/v1/parties/${partyId}/ready`,
    headers: { Authorization: `Bearer ${cora.accessToken}` },
    payload: { ready: true }
  });
  assert.equal(replayReady.statusCode, 200);

  for (const userId of [alice.userId, bob.userId, cora.userId]) {
    const notifications = (await store.listBotNotifications(userId)).filter(
      (notification) => notification.kind === 'exam_result'
    );
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.status, 'sent');
  }

  await app.close();
});
