import assert from 'node:assert/strict';
import test from 'node:test';

import type { Archetype } from '@sharaga/contracts';

import { applyExamRewardToProfile, computeExamOutcome, computeSuccessChancePct, hashToRollPct } from './exam.js';
import { getInitialProfile } from './profile.js';

const mixedParty: Array<{ userId: string; archetype: Archetype }> = [
  { userId: 'a', archetype: 'botan' },
  { userId: 'b', archetype: 'sportsman' },
  { userId: 'c', archetype: 'partygoer' }
];

const monoBotanParty: Array<{ userId: string; archetype: Archetype }> = [
  { userId: 'a', archetype: 'botan' },
  { userId: 'b', archetype: 'botan' },
  { userId: 'c', archetype: 'botan' }
];

test('mixed party gets a materially better success chance than mono-party', () => {
  const mixed = computeSuccessChancePct(mixedParty.map((member) => member.archetype), mixedParty.length);
  const mono = computeSuccessChancePct(monoBotanParty.map((member) => member.archetype), monoBotanParty.length);

  assert.ok(mixed > mono);
  assert.ok(mixed - mono >= 20);
});

test('exam roll is deterministic by seed', () => {
  assert.equal(hashToRollPct('seed-1'), hashToRollPct('seed-1'));
  assert.notEqual(hashToRollPct('seed-1'), hashToRollPct('seed-2'));
});

test('mixed party resolves to success for a fixed seed', () => {
  const success = computeExamOutcome(mixedParty, 'mixed-0');

  assert.equal(success.successChancePct, 90);
  assert.equal(success.rollPct, 17);
  assert.equal(success.outcome, 'success');
});

test('mono botan party resolves to partial failure for a fixed seed', () => {
  const partial = computeExamOutcome(monoBotanParty, 'mono-2');

  assert.equal(partial.successChancePct, 53);
  assert.equal(partial.rollPct, 54);
  assert.equal(partial.outcome, 'partial_failure');
});

test('success rewards stay better than partial failure rewards', () => {
  const success = computeExamOutcome(mixedParty, 'mixed-0');
  const partial = computeExamOutcome(monoBotanParty, 'mono-2');

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
