import assert from 'node:assert/strict';
import test from 'node:test';

import { applyExamRewardToProfile, computeExamOutcome, computeSuccessChancePct, hashToRollPct } from './exam.js';
import { getInitialProfile } from './profile.js';

test('mixed party gets a better success chance than mono-party', () => {
  const mixed = computeSuccessChancePct(['botan', 'sportsman', 'partygoer'], 3);
  const mono = computeSuccessChancePct(['botan', 'botan', 'botan'], 3);

  assert.ok(mixed > mono);
});

test('exam roll is deterministic by seed', () => {
  assert.equal(hashToRollPct('seed-1'), hashToRollPct('seed-1'));
  assert.notEqual(hashToRollPct('seed-1'), hashToRollPct('seed-2'));
});

test('success and partial failure return different rewards', () => {
  const success = computeExamOutcome([
    { userId: 'a', archetype: 'botan' },
    { userId: 'b', archetype: 'sportsman' },
    { userId: 'c', archetype: 'partygoer' }
  ], 'seed-success');
  const partial = computeExamOutcome([
    { userId: 'a', archetype: 'botan' },
    { userId: 'b', archetype: 'botan' },
    { userId: 'c', archetype: 'botan' }
  ], 'seed-partial');

  const successReward = success.rewards[0]!;
  const partialReward = partial.rewards[0]!;
  assert.ok(successReward.profileXp >= partialReward.profileXp);
  assert.ok(successReward.softCurrency >= partialReward.softCurrency);
});

test('reward application updates profile progression', () => {
  const now = new Date('2026-04-23T00:00:00.000Z');
  const profile = getInitialProfile('user-1', now);
  const next = applyExamRewardToProfile(profile, {
    profileXp: 4,
    archetypeXp: 2,
    softCurrency: 3,
    reputation: 2
  }, now);

  assert.equal(next.profileXp, 4);
  assert.equal(next.archetypeXp, 2);
  assert.equal(next.softCurrency, 3);
  assert.equal(next.reputation, 2);
});
