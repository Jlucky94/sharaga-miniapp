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

test('two-account async social loop: A contributes, B benefits, A sees reputation and feed signal', async () => {
  const store = new InMemoryAppStore();
  const clock = { now: new Date('2026-04-22T12:00:00.000Z') };
  const app = buildApp(
    { telegramBotToken: BOT_TOKEN, jwtSecret: 'jwt-secret', jwtExpiresIn: '1h', databaseUrl: 'postgresql://unused' },
    { store, now: () => clock.now }
  );

  // ── Player A authenticates and selects archetype ──────────────────────────
  const authARes = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(100, 'Alice') } });
  assert.equal(authARes.statusCode, 200);
  const tokenA = (authARes.json() as { accessToken: string }).accessToken;
  const userAId = (authARes.json() as { user: { id: string } }).user.id;

  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenA}` }, payload: { archetype: 'botan' } });

  // ── Player B authenticates and selects archetype ──────────────────────────
  const authBRes = await app.inject({ method: 'POST', url: '/api/v1/auth/telegram', payload: { initData: buildInitData(200, 'Bob') } });
  assert.equal(authBRes.statusCode, 200);
  const tokenB = (authBRes.json() as { accessToken: string }).accessToken;

  await app.inject({ method: 'POST', url: '/api/v1/class/select', headers: { Authorization: `Bearer ${tokenB}` }, payload: { archetype: 'sportsman' } });

  // ── A contributes 5x to notes project until it unlocks ───────────────────
  const projects = await store.listProjects();
  const notes = projects.find((p) => p.kind === 'notes')!;

  for (let i = 0; i < 5; i++) {
    clock.now = new Date(clock.now.getTime() + 31 * 60 * 1000);
    const res = await app.inject({
      method: 'POST', url: `/api/v1/projects/${notes.id}/contribute`,
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { requestId: `a000000${i}-0000-0000-0000-000000000001`, amount: 1 }
    });
    assert.equal(res.statusCode, 200, `A's contribution ${i + 1} should succeed`);
  }

  // Verify notes project is unlocked
  const projectsAfterUnlock = await app.inject({ method: 'GET', url: '/api/v1/projects', headers: { Authorization: `Bearer ${tokenA}` } });
  const notesState = (projectsAfterUnlock.json() as { projects: Array<{ kind: string; unlocked: boolean }> }).projects.find((p) => p.kind === 'notes');
  assert.ok(notesState?.unlocked, 'notes project should be unlocked after 5 contributions');

  // A's reputation should have gone up from unlock event
  const profileAAfterUnlock = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${tokenA}` } });
  const repAAfterUnlock = (profileAAfterUnlock.json() as { profile: { reputation: number } }).profile.reputation;
  assert.ok(repAAfterUnlock > 0, 'A should have reputation from project unlock');

  // ── B claims the benefit ──────────────────────────────────────────────────
  const claimRes = await app.inject({
    method: 'POST', url: `/api/v1/projects/${notes.id}/claim-benefit`,
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.equal(claimRes.statusCode, 200);
  const claimBody = claimRes.json() as { profile: { softCurrency: number } };
  assert.ok(claimBody.profile.softCurrency >= 2, 'B should receive soft currency from benefit');

  // Reload B — second claim should fail
  const claimAgain = await app.inject({
    method: 'POST', url: `/api/v1/projects/${notes.id}/claim-benefit`,
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.equal(claimAgain.statusCode, 409, 'duplicate claim should be rejected');

  // ── A's reputation increases after B's claim ─────────────────────────────
  const profileAAfterClaim = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${tokenA}` } });
  const repAAfterClaim = (profileAAfterClaim.json() as { profile: { reputation: number } }).profile.reputation;
  assert.ok(repAAfterClaim > repAAfterUnlock, 'A reputation should increase after B claims benefit');

  // ── A sees B's benefit claim in the feed ─────────────────────────────────
  const feedRes = await app.inject({ method: 'GET', url: '/api/v1/feed', headers: { Authorization: `Bearer ${tokenA}` } });
  assert.equal(feedRes.statusCode, 200);
  const feedItems = (feedRes.json() as { items: Array<{ kind: string; userFirstName: string }> }).items;
  const benefitItem = feedItems.find((i) => i.kind === 'benefit' && i.userFirstName === 'Bob');
  assert.ok(benefitItem, 'A should see B\'s benefit claim in the feed');

  // ── B likes A's contribution, A sees reputation bump ─────────────────────
  const repABeforeLike = repAAfterClaim;

  // Find A's contribution in the feed
  const contribItem = feedItems.find((i) => i.kind === 'contribution') as { kind: string; id: string } | undefined;
  if (contribItem) {
    const likeRes = await app.inject({
      method: 'POST', url: `/api/v1/contributions/${contribItem.id}/like`,
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.equal(likeRes.statusCode, 200);

    const profileAFinal = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${tokenA}` } });
    const repAFinal = (profileAFinal.json() as { profile: { reputation: number } }).profile.reputation;
    assert.ok(repAFinal > repABeforeLike, 'A reputation should increase after B likes A\'s contribution');
  }

  // ── Verify state is consistent after reload ───────────────────────────────
  const profileAReload = await app.inject({ method: 'GET', url: '/api/v1/profile', headers: { Authorization: `Bearer ${tokenA}` } });
  assert.equal(profileAReload.statusCode, 200);
  const profileAReloadData = profileAReload.json() as { profile: { userId: string; reputation: number } };
  assert.equal(profileAReloadData.profile.userId, userAId, 'reload returns same user');
  assert.ok(profileAReloadData.profile.reputation > 0, 'reputation persists across reload');

  // Projects state consistent after reload
  const projectsReload = await app.inject({ method: 'GET', url: '/api/v1/projects', headers: { Authorization: `Bearer ${tokenA}` } });
  const notesReload = (projectsReload.json() as { projects: Array<{ kind: string; unlocked: boolean }> }).projects.find((p) => p.kind === 'notes');
  assert.ok(notesReload?.unlocked, 'notes project stays unlocked after reload');

  await app.close();
});
