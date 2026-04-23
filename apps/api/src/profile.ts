import type {
  ActionId,
  ActionResult,
  Archetype,
  ProfileResponse,
  ProfileSnapshot,
  PublicUser
} from '@sharaga/contracts';
import { actionCatalog } from '@sharaga/contracts';

export const MAX_ENERGY = 3;
export const ENERGY_INTERVAL_MS = 30 * 60 * 1000;
export const PROFILE_XP_PER_ACTION = 10;
export const SOFT_CURRENCY_PER_ACTION = 1;

export type StoredProfile = ProfileSnapshot & {
  reputation: number;
  createdAt: Date;
  updatedAt: Date;
  energyUpdatedAt: Date;
};

export type StoredUser = PublicUser & {
  writeAccessGranted: boolean;
  isSeededDemo: boolean;
};

export type StoredPlayer = {
  user: StoredUser;
  profile: StoredProfile;
};

function toPublicUser(user: StoredUser): PublicUser {
  const { writeAccessGranted: _writeAccessGranted, isSeededDemo: _isSeededDemo, ...publicUser } = user;
  return publicUser;
}

export function getInitialProfile(userId: string, now: Date): StoredProfile {
  return {
    userId,
    archetype: null,
    level: 1,
    profileXp: 0,
    archetypeXp: 0,
    energy: MAX_ENERGY,
    softCurrency: 0,
    reputation: 0,
    createdAt: now,
    updatedAt: now,
    energyUpdatedAt: now
  };
}

export function calculateLevel(profileXp: number): number {
  return 1 + Math.floor(profileXp / 40);
}

export function refreshEnergy(profile: StoredProfile, now: Date): { profile: StoredProfile; changed: boolean } {
  if (profile.energy >= MAX_ENERGY) {
    return { profile, changed: false };
  }

  const elapsedMs = now.getTime() - profile.energyUpdatedAt.getTime();
  if (elapsedMs < ENERGY_INTERVAL_MS) {
    return { profile, changed: false };
  }

  const regenerated = Math.floor(elapsedMs / ENERGY_INTERVAL_MS);
  if (regenerated <= 0) {
    return { profile, changed: false };
  }

  const nextEnergy = Math.min(MAX_ENERGY, profile.energy + regenerated);
  const nextEnergyUpdatedAt =
    nextEnergy === MAX_ENERGY
      ? now
      : new Date(profile.energyUpdatedAt.getTime() + regenerated * ENERGY_INTERVAL_MS);

  return {
    changed: nextEnergy !== profile.energy || nextEnergyUpdatedAt.getTime() !== profile.energyUpdatedAt.getTime(),
    profile: {
      ...profile,
      energy: nextEnergy,
      energyUpdatedAt: nextEnergyUpdatedAt,
      updatedAt: now
    }
  };
}

export function getNextEnergyAt(profile: StoredProfile): Date | null {
  if (profile.energy >= MAX_ENERGY) {
    return null;
  }

  return new Date(profile.energyUpdatedAt.getTime() + ENERGY_INTERVAL_MS);
}

function getArchetypeXpReward(selectedArchetype: Archetype, actionId: ActionId): number {
  const action = actionCatalog[actionId];

  if (action.archetypeAffinity === null) {
    return 4;
  }

  if (action.archetypeAffinity === selectedArchetype) {
    return 6;
  }

  return 2;
}

export function selectArchetype(profile: StoredProfile, archetype: Archetype, now: Date): StoredProfile {
  return {
    ...profile,
    archetype,
    updatedAt: now
  };
}

export function performAction(
  profile: StoredProfile,
  actionId: ActionId,
  now: Date
): { profile: StoredProfile; result: ActionResult } | { errorCode: 'ARCHETYPE_REQUIRED' | 'INSUFFICIENT_ENERGY' } {
  if (!profile.archetype) {
    return { errorCode: 'ARCHETYPE_REQUIRED' };
  }

  const refreshed = refreshEnergy(profile, now).profile;
  const selectedArchetype = refreshed.archetype;

  if (!selectedArchetype) {
    return { errorCode: 'ARCHETYPE_REQUIRED' };
  }

  if (refreshed.energy <= 0) {
    return { errorCode: 'INSUFFICIENT_ENERGY' };
  }

  const archetypeXp = getArchetypeXpReward(selectedArchetype, actionId);
  const nextProfileXp = refreshed.profileXp + PROFILE_XP_PER_ACTION;
  const nextProfile: StoredProfile = {
    ...refreshed,
    level: calculateLevel(nextProfileXp),
    profileXp: nextProfileXp,
    archetypeXp: refreshed.archetypeXp + archetypeXp,
    softCurrency: refreshed.softCurrency + SOFT_CURRENCY_PER_ACTION,
    energy: refreshed.energy - 1,
    energyUpdatedAt: refreshed.energy === MAX_ENERGY ? now : refreshed.energyUpdatedAt,
    updatedAt: now
  };

  return {
    profile: nextProfile,
    result: {
      actionId,
      text: actionCatalog[actionId].resultCopy,
      rewards: {
        profileXp: PROFILE_XP_PER_ACTION,
        archetypeXp,
        softCurrency: SOFT_CURRENCY_PER_ACTION
      }
    }
  };
}

export function buildProfileResponse(player: StoredPlayer, now: Date): ProfileResponse {
  return {
    user: toPublicUser(player.user),
    profile: {
      userId: player.profile.userId,
      archetype: player.profile.archetype,
      level: player.profile.level,
      profileXp: player.profile.profileXp,
      archetypeXp: player.profile.archetypeXp,
      energy: player.profile.energy,
      softCurrency: player.profile.softCurrency,
      reputation: player.profile.reputation
    },
    writeAccessGranted: player.user.writeAccessGranted,
    serverTime: now.toISOString(),
    nextEnergyAt: getNextEnergyAt(player.profile)?.toISOString() ?? null
  };
}

export function isValidArchetype(value: string): value is Archetype {
  return value === 'botan' || value === 'sportsman' || value === 'partygoer';
}
