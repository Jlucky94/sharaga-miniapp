import type { Archetype } from '@sharaga/contracts';

import type { StoredProfile } from './profile.js';

export const CONTRIBUTE_ENERGY_COST = 1;
export const CONTRIBUTE_PROFILE_XP = 8;
export const CONTRIBUTE_ARCHETYPE_XP_AFFINITY = 6;
export const CONTRIBUTE_ARCHETYPE_XP_NEUTRAL = 2;
export const CONTRIBUTE_ARCHETYPE_XP_UNSET = 4;
export const CONTRIBUTE_SOFT = 1;

export const REPUTATION_ON_UNLOCK_CONTRIBUTOR = 3;
export const REPUTATION_ON_BENEFIT_CLAIM = 2;
export const REPUTATION_ON_LIKE = 1;

export const BENEFIT_PROFILE_XP = 5;
export const BENEFIT_SOFT_CURRENCY = 2;

export type StoredProject = {
  id: string;
  kind: 'notes' | 'gym' | 'festival';
  title: string;
  description: string;
  threshold: number;
  progress: number;
  affinity: Archetype | null;
  unlockedAt: Date | null;
  unlockCycle: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ContributionReward = {
  profileXp: number;
  archetypeXp: number;
  softCurrency: number;
};

export function computeContributionReward(
  archetype: Archetype | null,
  projectAffinity: Archetype | null
): ContributionReward {
  let archetypeXp: number;

  if (archetype === null) {
    archetypeXp = CONTRIBUTE_ARCHETYPE_XP_UNSET;
  } else if (projectAffinity === null) {
    archetypeXp = CONTRIBUTE_ARCHETYPE_XP_UNSET;
  } else if (archetype === projectAffinity) {
    archetypeXp = CONTRIBUTE_ARCHETYPE_XP_AFFINITY;
  } else {
    archetypeXp = CONTRIBUTE_ARCHETYPE_XP_NEUTRAL;
  }

  return {
    profileXp: CONTRIBUTE_PROFILE_XP,
    archetypeXp,
    softCurrency: CONTRIBUTE_SOFT
  };
}

export function applyContributeDelta(profile: StoredProfile, reward: ContributionReward, now: Date): StoredProfile {
  const nextProfileXp = profile.profileXp + reward.profileXp;
  const nextLevel = 1 + Math.floor(nextProfileXp / 40);
  const energyWasMax = profile.energy >= 3;

  return {
    ...profile,
    profileXp: nextProfileXp,
    archetypeXp: profile.archetypeXp + reward.archetypeXp,
    softCurrency: profile.softCurrency + reward.softCurrency,
    energy: profile.energy - CONTRIBUTE_ENERGY_COST,
    energyUpdatedAt: energyWasMax ? now : profile.energyUpdatedAt,
    level: nextLevel,
    updatedAt: now
  };
}

export function computeBenefitReward(): { profileXp: number; softCurrency: number } {
  return {
    profileXp: BENEFIT_PROFILE_XP,
    softCurrency: BENEFIT_SOFT_CURRENCY
  };
}

export function applyBenefitDelta(profile: StoredProfile, now: Date): StoredProfile {
  const reward = computeBenefitReward();
  const nextProfileXp = profile.profileXp + reward.profileXp;
  const nextLevel = 1 + Math.floor(nextProfileXp / 40);

  return {
    ...profile,
    profileXp: nextProfileXp,
    softCurrency: profile.softCurrency + reward.softCurrency,
    level: nextLevel,
    updatedAt: now
  };
}

export function applyReputationDelta(profile: StoredProfile, delta: number, now: Date): StoredProfile {
  return {
    ...profile,
    reputation: profile.reputation + delta,
    updatedAt: now
  };
}
