import { randomUUID } from 'node:crypto';

import { PrismaClient, type Prisma } from '@prisma/client';
import type { PublicUser } from '@sharaga/contracts';

import type { TelegramUserPayload } from './auth.js';
import { getInitialProfile, type StoredPlayer, type StoredProfile } from './profile.js';

export type ProfileEventType = 'profile.created' | 'archetype.selected' | 'action.performed';

export type ProfileEventRecord = {
  id: string;
  userId: string;
  eventType: ProfileEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type AppStore = {
  close?: () => Promise<void>;
  authenticateTelegramUser: (
    telegramUser: TelegramUserPayload,
    now: Date
  ) => Promise<{ player: StoredPlayer; createdProfile: boolean }>;
  findUserById: (userId: string) => Promise<PublicUser | null>;
  findPlayerByUserId: (userId: string) => Promise<StoredPlayer | null>;
  replaceProfile: (userId: string, profile: StoredProfile, event?: Omit<ProfileEventRecord, 'id'>) => Promise<StoredProfile>;
  listEvents: (userId: string) => Promise<ProfileEventRecord[]>;
};

function toPublicUser(user: {
  id: string;
  telegramId: bigint | number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  photoUrl: string | null;
}): PublicUser {
  return {
    id: user.id,
    telegramId: Number(user.telegramId),
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    languageCode: user.languageCode,
    photoUrl: user.photoUrl
  };
}

function fromPrismaProfile(profile: {
  userId: string;
  archetype: 'botan' | 'sportsman' | 'partygoer' | null;
  level: number;
  profileXp: number;
  archetypeXp: number;
  energy: number;
  softCurrency: number;
  energyUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): StoredProfile {
  return {
    userId: profile.userId,
    archetype: profile.archetype,
    level: profile.level,
    profileXp: profile.profileXp,
    archetypeXp: profile.archetypeXp,
    energy: profile.energy,
    softCurrency: profile.softCurrency,
    energyUpdatedAt: profile.energyUpdatedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function toPrismaEventType(eventType: ProfileEventType) {
  if (eventType === 'profile.created') {
    return 'profile_created' as const;
  }

  if (eventType === 'archetype.selected') {
    return 'archetype_selected' as const;
  }

  return 'action_performed' as const;
}

function fromPrismaEventType(eventType: 'profile_created' | 'archetype_selected' | 'action_performed'): ProfileEventType {
  if (eventType === 'profile_created') {
    return 'profile.created';
  }

  if (eventType === 'archetype_selected') {
    return 'archetype.selected';
  }

  return 'action.performed';
}

function toPrismaPayload(payload: Record<string, unknown>): Prisma.InputJsonObject {
  return payload as Prisma.InputJsonObject;
}

export function createPrismaStore(databaseUrl: string): AppStore {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });

  return {
    close: async () => {
      await prisma.$disconnect();
    },
    authenticateTelegramUser: async (telegramUser, now) => {
      const telegramId = BigInt(telegramUser.id);
      const user = await prisma.user.upsert({
        where: { telegramId },
        create: {
          telegramId,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name ?? null,
          username: telegramUser.username ?? null,
          languageCode: telegramUser.language_code ?? null,
          photoUrl: telegramUser.photo_url ?? null
        },
        update: {
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name ?? null,
          username: telegramUser.username ?? null,
          languageCode: telegramUser.language_code ?? null,
          photoUrl: telegramUser.photo_url ?? null
        }
      });

      const existingProfile = await prisma.profile.findUnique({
        where: { userId: user.id }
      });

      if (existingProfile) {
        return {
          createdProfile: false,
          player: {
            user: toPublicUser(user),
            profile: fromPrismaProfile(existingProfile)
          }
        };
      }

      const profile = getInitialProfile(user.id, now);
      const createdProfile = await prisma.profile.create({
        data: {
          userId: profile.userId,
          archetype: profile.archetype,
          level: profile.level,
          profileXp: profile.profileXp,
          archetypeXp: profile.archetypeXp,
          energy: profile.energy,
          softCurrency: profile.softCurrency,
          energyUpdatedAt: profile.energyUpdatedAt
        }
      });

      await prisma.profileEvent.create({
        data: {
          userId: user.id,
          eventType: 'profile_created',
          payload: {
            origin: 'telegram_auth'
          }
        }
      });

      return {
        createdProfile: true,
        player: {
          user: toPublicUser(user),
          profile: fromPrismaProfile(createdProfile)
        }
      };
    },
    findUserById: async (userId) => {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      return user ? toPublicUser(user) : null;
    },
    findPlayerByUserId: async (userId) => {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { user: true }
      });

      if (!profile) {
        return null;
      }

      return {
        user: toPublicUser(profile.user),
        profile: fromPrismaProfile(profile)
      };
    },
    replaceProfile: async (userId, profile, event) => {
      const updated = await prisma.profile.update({
        where: { userId },
        data: {
          archetype: profile.archetype,
          level: profile.level,
          profileXp: profile.profileXp,
          archetypeXp: profile.archetypeXp,
          energy: profile.energy,
          softCurrency: profile.softCurrency,
          energyUpdatedAt: profile.energyUpdatedAt
        }
      });

      if (event) {
        await prisma.profileEvent.create({
          data: {
            userId: event.userId,
            eventType: toPrismaEventType(event.eventType),
            payload: toPrismaPayload(event.payload),
            createdAt: event.createdAt
          }
        });
      }

      return fromPrismaProfile(updated);
    },
    listEvents: async (userId) => {
      const events = await prisma.profileEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      });

      return events.map((event: { id: string; userId: string; eventType: 'profile_created' | 'archetype_selected' | 'action_performed'; payload: Prisma.JsonValue; createdAt: Date }) => ({
        id: event.id,
        userId: event.userId,
        eventType: fromPrismaEventType(event.eventType),
        payload: event.payload as Record<string, unknown>,
        createdAt: event.createdAt
      }));
    }
  };
}

export class InMemoryAppStore implements AppStore {
  private readonly usersById = new Map<string, PublicUser>();
  private readonly userIdsByTelegramId = new Map<number, string>();
  private readonly profilesByUserId = new Map<string, StoredProfile>();
  private readonly eventsByUserId = new Map<string, ProfileEventRecord[]>();

  async authenticateTelegramUser(telegramUser: TelegramUserPayload, now: Date) {
    const existingUserId = this.userIdsByTelegramId.get(telegramUser.id);
    const user: PublicUser = {
      id: existingUserId ?? randomUUID(),
      telegramId: telegramUser.id,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name ?? null,
      username: telegramUser.username ?? null,
      languageCode: telegramUser.language_code ?? null,
      photoUrl: telegramUser.photo_url ?? null
    };

    this.usersById.set(user.id, user);
    this.userIdsByTelegramId.set(user.telegramId, user.id);

    const existingProfile = this.profilesByUserId.get(user.id);
    if (existingProfile) {
      return {
        createdProfile: false,
        player: {
          user,
          profile: existingProfile
        }
      };
    }

    const profile = getInitialProfile(user.id, now);
    this.profilesByUserId.set(user.id, profile);
    this.pushEvent({
      userId: user.id,
      eventType: 'profile.created',
      payload: { origin: 'telegram_auth' },
      createdAt: now
    });

    return {
      createdProfile: true,
      player: {
        user,
        profile
      }
    };
  }

  async findUserById(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async findPlayerByUserId(userId: string) {
    const user = this.usersById.get(userId);
    const profile = this.profilesByUserId.get(userId);

    if (!user || !profile) {
      return null;
    }

    return { user, profile };
  }

  async replaceProfile(userId: string, profile: StoredProfile, event?: Omit<ProfileEventRecord, 'id'>) {
    this.profilesByUserId.set(userId, profile);

    if (event) {
      this.pushEvent(event);
    }

    return profile;
  }

  async listEvents(userId: string) {
    return [...(this.eventsByUserId.get(userId) ?? [])];
  }

  private pushEvent(event: Omit<ProfileEventRecord, 'id'>) {
    const events = this.eventsByUserId.get(event.userId) ?? [];
    events.push({ ...event, id: randomUUID() });
    this.eventsByUserId.set(event.userId, events);
  }
}
