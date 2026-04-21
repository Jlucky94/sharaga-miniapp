import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actionCatalog,
  actionResultSchema,
  actionIds,
  archetypeSchema,
  profileResponseSchema,
  selectArchetypeRequestSchema
} from './index.js';

test('archetype schema accepts only supported archetypes', () => {
  assert.equal(archetypeSchema.parse('botan'), 'botan');
  assert.throws(() => archetypeSchema.parse('wizard'));
});

test('action catalog covers every declared action id', () => {
  assert.deepEqual(Object.keys(actionCatalog).sort(), [...actionIds].sort());
});

test('profile response schema accepts the expected wire shape', () => {
  const parsed = profileResponseSchema.parse({
    user: {
      id: 'c2fbc0cd-0c53-4702-b8f7-bff6763d58b0',
      telegramId: 42,
      firstName: 'Jane',
      lastName: null,
      username: 'jane42',
      languageCode: 'en',
      photoUrl: null
    },
    profile: {
      userId: 'c2fbc0cd-0c53-4702-b8f7-bff6763d58b0',
      archetype: 'botan',
      level: 1,
      profileXp: 10,
      archetypeXp: 6,
      energy: 2,
      softCurrency: 1,
      reputation: 0
    },
    serverTime: '2026-04-21T00:00:00.000Z',
    nextEnergyAt: '2026-04-21T00:30:00.000Z'
  });

  assert.equal(parsed.profile.energy, 2);
});

test('request/response schemas stay aligned with action result payloads', () => {
  assert.equal(selectArchetypeRequestSchema.parse({ archetype: 'partygoer' }).archetype, 'partygoer');

  const parsed = actionResultSchema.parse({
    actionId: 'help_classmate',
    text: 'You stepped in for a classmate and made the whole day feel lighter.',
    rewards: {
      profileXp: 10,
      archetypeXp: 4,
      softCurrency: 1
    }
  });

  assert.equal(parsed.rewards.archetypeXp, 4);
});
