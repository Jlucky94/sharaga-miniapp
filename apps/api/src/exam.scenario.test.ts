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
  const authBody = authRes.json() as { accessToken: string; user: { id: string } };
  const token = authBody.accessToken;
  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${token}` }, payload: { archetype } });
  return { accessToken: token, userId: authBody.user.id };
}

async function getProfileSnapshot(app: ReturnType<typeof buildApp>, accessToken: string) {
  const response = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${accessToken}` } });
  assert.equal(response.statusCode, 200);
  return (response.json() as {
    profile: {
      userId: string;
      level: number;
      profileXp: number;
      archetypeXp: number;
      softCurrency: number;
      reputation: number;
    };
  }).profile;
}

test('three-account exam loop: queue, ready, autostart, global feed, and final ready replay stay idempotent', async () => {
  const clock = { now: new Date('2026-04-23T12:00:00.000Z') };
  const store = new InMemoryAppStore();
  const app = buildApp(
    { telegramBotToken: BOT_TOKEN, jwtSecret: 'jwt-secret', jwtExpiresIn: '1h', databaseUrl: 'postgresql://unused' },
    { store, now: () => clock.now }
  );

  const alice = await authAs(app, 100, 'Alice', 'botan');
  const bob = await authAs(app, 200, 'Bob', 'sportsman');
  const cora = await authAs(app, 300, 'Cora', 'partygoer');

  const queueA = await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${alice.accessToken}` }, payload: { capacity: 3 } });
  const partyId = (queueA.json() as { party: { id: string } }).party.id;
  await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${bob.accessToken}` }, payload: { capacity: 3 } });
  await app.inject({ method: 'POST', url: '/api/v1/parties/queue', headers: { Authorization: `Bearer ${cora.accessToken}` }, payload: { capacity: 3 } });

  const readyA = await app.inject({ method: 'POST', url: `/api/v1/parties/${partyId}/ready`, headers: { Authorization: `Bearer ${alice.accessToken}` }, payload: { ready: true } });
  assert.equal(readyA.statusCode, 200);
  assert.equal((readyA.json() as { run: null }).run, null);

  const readyB = await app.inject({ method: 'POST', url: `/api/v1/parties/${partyId}/ready`, headers: { Authorization: `Bearer ${bob.accessToken}` }, payload: { ready: true } });
  assert.equal((readyB.json() as { run: null }).run, null);

  clock.now = new Date('2026-04-23T12:01:00.000Z');
  const readyC = await app.inject({ method: 'POST', url: `/api/v1/parties/${partyId}/ready`, headers: { Authorization: `Bearer ${cora.accessToken}` }, payload: { ready: true } });
  assert.equal(readyC.statusCode, 200);
  const run = (readyC.json() as { run: { id: string; outcome: string; rewards: Array<{ profileXp: number }> }; party: null }).run;
  assert.ok(run);
  assert.equal((readyC.json() as { party: null }).party, null);
  assert.ok(['success', 'partial_failure'].includes(run.outcome));
  assert.equal(run.rewards.length, 3);

  const profileAAfterRun = await getProfileSnapshot(app, alice.accessToken);
  const profileBAfterRun = await getProfileSnapshot(app, bob.accessToken);
  const profileCAfterRun = await getProfileSnapshot(app, cora.accessToken);
  assert.ok(profileAAfterRun.profileXp > 0);

  const examState = await app.inject({ method: 'GET', url: '/api/v1/exam', headers: { Authorization: `Bearer ${alice.accessToken}` } });
  assert.equal((examState.json() as { latestRun: { partyId: string } }).latestRun.partyId, partyId);

  const ownerEventsAfterRun = await store.listEvents(alice.userId);
  assert.equal(ownerEventsAfterRun.filter((event) => event.eventType === 'exam.completed').length, 1);

  const ownerFeed = await app.inject({ method: 'GET', url: '/api/v1/feed', headers: { Authorization: `Bearer ${alice.accessToken}` } });
  const memberFeed = await app.inject({ method: 'GET', url: '/api/v1/feed', headers: { Authorization: `Bearer ${bob.accessToken}` } });
  const ownerExamItems = (ownerFeed.json() as { items: Array<{ kind: string; partyId: string }> }).items.filter((item) => item.kind === 'exam_result');
  const memberExamItems = (memberFeed.json() as { items: Array<{ kind: string; partyId: string }> }).items.filter((item) => item.kind === 'exam_result');
  assert.equal(ownerExamItems.length, 1);
  assert.equal(memberExamItems.length, 1);
  assert.equal(ownerExamItems[0]?.partyId, partyId);
  assert.equal(memberExamItems[0]?.partyId, partyId);

  const replayReady = await app.inject({
    method: 'POST',
    url: `/api/v1/parties/${partyId}/ready`,
    headers: { Authorization: `Bearer ${cora.accessToken}` },
    payload: { ready: true }
  });
  assert.equal(replayReady.statusCode, 200);
  const replayBody = replayReady.json() as { party: null; run: { id: string } };
  assert.equal(replayBody.party, null);
  assert.equal(replayBody.run.id, run.id);

  const profileAAfterReplay = await getProfileSnapshot(app, alice.accessToken);
  const profileBAfterReplay = await getProfileSnapshot(app, bob.accessToken);
  const profileCAfterReplay = await getProfileSnapshot(app, cora.accessToken);
  assert.deepEqual(profileAAfterReplay, profileAAfterRun);
  assert.deepEqual(profileBAfterReplay, profileBAfterRun);
  assert.deepEqual(profileCAfterReplay, profileCAfterRun);

  const ownerEventsAfterReplay = await store.listEvents(alice.userId);
  assert.equal(ownerEventsAfterReplay.filter((event) => event.eventType === 'exam.completed').length, 1);

  const memberFeedAfterReplay = await app.inject({ method: 'GET', url: '/api/v1/feed', headers: { Authorization: `Bearer ${bob.accessToken}` } });
  const memberExamItemsAfterReplay = (memberFeedAfterReplay.json() as { items: Array<{ kind: string; partyId: string }> }).items.filter((item) => item.kind === 'exam_result');
  assert.equal(memberExamItemsAfterReplay.length, 1);
  assert.equal(memberExamItemsAfterReplay[0]?.partyId, partyId);

  await app.close();
});
