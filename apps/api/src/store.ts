import { randomUUID } from 'node:crypto';

import { PrismaClient, type Prisma } from '@prisma/client';
import type { FeedItem, PublicUser } from '@sharaga/contracts';

// After BUILD-P2 migration runs, the Prisma client will include these models.
// Until then, we cast to bypass the stale generated types.
type AnyPrisma = PrismaClient & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

import type { TelegramUserPayload } from './auth.js';
import { getInitialProfile, type StoredPlayer, type StoredProfile } from './profile.js';
import {
  applyReputationDelta,
  REPUTATION_ON_LIKE,
  type StoredProject
} from './social.js';

export type ProfileEventType =
  | 'profile.created'
  | 'archetype.selected'
  | 'action.performed'
  | 'project.contributed'
  | 'project.unlocked'
  | 'benefit.claimed'
  | 'contribution.liked'
  | 'reputation.gained';

export type ProfileEventRecord = {
  id: string;
  userId: string;
  eventType: ProfileEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type StoredContribution = {
  id: string;
  projectId: string;
  userId: string;
  actionId: string;
  amount: number;
  requestId: string;
  createdAt: Date;
};

export type StoredBenefitClaim = {
  id: string;
  projectId: string;
  userId: string;
  unlockCycle: number;
  createdAt: Date;
};

export type StoredContributionLike = {
  id: string;
  contributionId: string;
  fromUserId: string;
  createdAt: Date;
};

export type ContributeResult = {
  contribution: StoredContribution;
  project: StoredProject;
  profile: StoredProfile;
  unlocked: boolean;
  contributorsAtUnlock?: string[];
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
  bumpReputation: (userId: string, delta: number, event: Omit<ProfileEventRecord, 'id'>, now: Date) => Promise<StoredProfile>;
  listEvents: (userId: string) => Promise<ProfileEventRecord[]>;
  listProjects: () => Promise<StoredProject[]>;
  getProjectById: (id: string) => Promise<StoredProject | null>;
  contributeToProject: (args: {
    userId: string;
    projectId: string;
    requestId: string;
    amount: number;
    actionId: string;
    profileAfter: StoredProfile;
    events: Omit<ProfileEventRecord, 'id'>[];
    now: Date;
  }) => Promise<ContributeResult>;
  claimBenefit: (args: {
    userId: string;
    projectId: string;
    profileAfter: StoredProfile;
    events: Omit<ProfileEventRecord, 'id'>[];
    now: Date;
  }) => Promise<{ claim: StoredBenefitClaim; profile: StoredProfile }>;
  likeContribution: (args: {
    contributionId: string;
    fromUserId: string;
    now: Date;
  }) => Promise<{ like: StoredContributionLike; toUserId: string }>;
  getContributionById: (id: string) => Promise<StoredContribution | null>;
  listFeed: (args: { limit: number; cursor?: Date }) => Promise<FeedItem[]>;
  listProjectContributorIds: (projectId: string) => Promise<string[]>;
};

// ─── Prisma helpers ──────────────────────────────────────────────────────────

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
  reputation?: number;
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
    reputation: profile.reputation ?? 0,
    energyUpdatedAt: profile.energyUpdatedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function fromPrismaProject(p: {
  id: string;
  kind: 'notes' | 'gym' | 'festival';
  title: string;
  description: string;
  threshold: number;
  progress: number;
  affinity: 'botan' | 'sportsman' | 'partygoer' | null;
  unlockedAt: Date | null;
  unlockCycle: number;
  createdAt: Date;
  updatedAt: Date;
}): StoredProject {
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    description: p.description,
    threshold: p.threshold,
    progress: p.progress,
    affinity: p.affinity,
    unlockedAt: p.unlockedAt,
    unlockCycle: p.unlockCycle,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}

const prismaEventTypeMap: Record<ProfileEventType, string> = {
  'profile.created': 'profile_created',
  'archetype.selected': 'archetype_selected',
  'action.performed': 'action_performed',
  'project.contributed': 'project_contributed',
  'project.unlocked': 'project_unlocked',
  'benefit.claimed': 'benefit_claimed',
  'contribution.liked': 'contribution_liked',
  'reputation.gained': 'reputation_gained'
};

const reverseEventTypeMap: Record<string, ProfileEventType> = Object.fromEntries(
  Object.entries(prismaEventTypeMap).map(([k, v]) => [v, k as ProfileEventType])
);

function toPrismaEventType(eventType: ProfileEventType) {
  return prismaEventTypeMap[eventType] as
    | 'profile_created'
    | 'archetype_selected'
    | 'action_performed'
    | 'project_contributed'
    | 'project_unlocked'
    | 'benefit_claimed'
    | 'contribution_liked'
    | 'reputation_gained';
}

function fromPrismaEventType(eventType: string): ProfileEventType {
  return reverseEventTypeMap[eventType] ?? 'action.performed';
}

function toPrismaPayload(payload: Record<string, unknown>): Prisma.InputJsonObject {
  return payload as Prisma.InputJsonObject;
}

// ─── Prisma store ─────────────────────────────────────────────────────────────

export function createPrismaStore(databaseUrl: string): AppStore {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    }
  });

  async function writeEvents(events: Omit<ProfileEventRecord, 'id'>[]) {
    if (events.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.profileEvent.createMany({
      data: events.map((e) => ({
        userId: e.userId,
        eventType: toPrismaEventType(e.eventType),
        payload: toPrismaPayload(e.payload),
        createdAt: e.createdAt
      })) as any
    });
  }

  // Access new BUILD-P2 models through AnyPrisma cast until client is regenerated after migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as AnyPrisma;

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

      const existingProfile = await prisma.profile.findUnique({ where: { userId: user.id } });

      if (existingProfile) {
        return {
          createdProfile: false,
          player: { user: toPublicUser(user), profile: fromPrismaProfile(existingProfile) }
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
          reputation: profile.reputation,
          energyUpdatedAt: profile.energyUpdatedAt
        } as any
      });

      await prisma.profileEvent.create({
        data: { userId: user.id, eventType: 'profile_created', payload: { origin: 'telegram_auth' } }
      });

      return {
        createdProfile: true,
        player: { user: toPublicUser(user), profile: fromPrismaProfile(createdProfile) }
      };
    },

    findUserById: async (userId) => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return user ? toPublicUser(user) : null;
    },

    findPlayerByUserId: async (userId) => {
      const profile = await prisma.profile.findUnique({ where: { userId }, include: { user: true } });
      if (!profile) return null;
      return { user: toPublicUser(profile.user), profile: fromPrismaProfile(profile) };
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
          reputation: profile.reputation,
          energyUpdatedAt: profile.energyUpdatedAt
        } as any
      });

      if (event) {
        await prisma.profileEvent.create({
          data: {
            userId: event.userId,
            eventType: toPrismaEventType(event.eventType),
            payload: toPrismaPayload(event.payload),
            createdAt: event.createdAt
          } as any
        });
      }

      return fromPrismaProfile(updated);
    },

    bumpReputation: async (userId, delta, event, now) => {
      const updated = await prisma.profile.update({
        where: { userId },
        data: { reputation: { increment: delta }, updatedAt: now } as any
      });

      await prisma.profileEvent.create({
        data: {
          userId: event.userId,
          eventType: toPrismaEventType(event.eventType),
          payload: toPrismaPayload(event.payload),
          createdAt: event.createdAt
        } as any
      });

      return fromPrismaProfile(updated as any);
    },

    listEvents: async (userId) => {
      const events = await prisma.profileEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
      });

      return events.map((e) => ({
        id: e.id,
        userId: e.userId,
        eventType: fromPrismaEventType(e.eventType),
        payload: e.payload as Record<string, unknown>,
        createdAt: e.createdAt
      }));
    },

    listProjects: async () => {
      const projects = await db.project.findMany({ orderBy: { createdAt: 'asc' } });
      return projects.map(fromPrismaProject);
    },

    getProjectById: async (id) => {
      const p = await db.project.findUnique({ where: { id } });
      return p ? fromPrismaProject(p) : null;
    },

    contributeToProject: async ({ userId, projectId, requestId, amount, actionId, profileAfter, events, now }) => {
      // Idempotency: return existing contribution without re-rewarding
      const existing = await db.contribution.findUnique({ where: { userId_requestId: { userId, requestId } } });
      if (existing) {
        const project = await db.project.findUnique({ where: { id: projectId } });
        const profile = await prisma.profile.findUnique({ where: { userId } });
        return {
          contribution: { ...existing, createdAt: existing.createdAt },
          project: fromPrismaProject(project!),
          profile: fromPrismaProfile(profile!),
          unlocked: project!.unlockedAt !== null
        };
      }

      // CAS loop for progress
      const MAX_RETRIES = 5;
      let attempt = 0;
      let updatedProject: StoredProject | null = null;
      let didUnlock = false;
      let contributorsAtUnlock: string[] | undefined;

      while (attempt < MAX_RETRIES) {
        attempt++;
        const current = await db.project.findUnique({ where: { id: projectId } });
        if (!current) throw new Error('PROJECT_NOT_FOUND');
        if (current.unlockedAt !== null) throw new Error('PROJECT_ALREADY_UNLOCKED');

        const newProgress = current.progress + amount;
        const unlocks = newProgress >= current.threshold;

        try {
          const result = await prisma.$transaction(async (txRaw) => {
            const tx = txRaw as AnyPrisma;
            // CAS: update only if progress hasn't changed
            const count = await tx.project.updateMany({
              where: { id: projectId, progress: current.progress },
              data: {
                progress: newProgress,
                unlockedAt: unlocks ? now : undefined,
                updatedAt: now
              }
            });

            if (count.count === 0) throw new Error('CAS_RETRY');

            const contrib = await tx.contribution.create({
              data: { projectId, userId, actionId, amount, requestId, createdAt: now }
            });

            await tx.profile.update({
              where: { userId },
              data: {
                archetype: profileAfter.archetype,
                level: profileAfter.level,
                profileXp: profileAfter.profileXp,
                archetypeXp: profileAfter.archetypeXp,
                energy: profileAfter.energy,
                softCurrency: profileAfter.softCurrency,
                reputation: profileAfter.reputation,
                energyUpdatedAt: profileAfter.energyUpdatedAt,
                updatedAt: now
              } as any
            });

            await tx.profileEvent.createMany({
              data: events.map((e) => ({
                userId: e.userId,
                eventType: toPrismaEventType(e.eventType),
                payload: toPrismaPayload(
                  e.eventType === 'project.contributed'
                    ? { ...e.payload, contributionId: contrib.id }
                    : e.payload
                ),
                createdAt: e.createdAt
              })) as any
            });

            const freshProject = await tx.project.findUnique({ where: { id: projectId } });
            return { contrib, freshProject: fromPrismaProject(freshProject!) };
          });

          updatedProject = result.freshProject;
          didUnlock = unlocks;

          if (unlocks) {
            // Collect all distinct contributors for reputation payouts
            const contribs = await db.contribution.findMany({
              where: { projectId },
              select: { userId: true },
              distinct: ['userId']
            });
            contributorsAtUnlock = contribs.map((c) => c.userId);

            // Fire unlock event + reputation gains
            const unlockEvents: Parameters<typeof writeEvents>[0] = [
              {
                userId,
                eventType: 'project.unlocked',
                payload: { projectId, projectKind: current.kind },
                createdAt: now
              },
              ...contributorsAtUnlock.map((cUserId) => ({
                userId: cUserId,
                eventType: 'reputation.gained' as ProfileEventType,
                payload: { reason: 'project_unlocked', projectId, delta: 3 },
                createdAt: now
              }))
            ];
            await writeEvents(unlockEvents);

            await prisma.profile.updateMany({
              where: { userId: { in: contributorsAtUnlock } },
              data: { reputation: { increment: 3 } } as any
            });
          }

          break;
        } catch (err) {
          if (err instanceof Error && err.message === 'CAS_RETRY') continue;
          throw err;
        }
      }

      if (!updatedProject) {
        throw Object.assign(new Error('CONTRIBUTE_RETRY_EXHAUSTED'), { statusCode: 503 });
      }

      const finalProfile = await prisma.profile.findUnique({ where: { userId } });
      const contribution = await db.contribution.findUnique({ where: { userId_requestId: { userId, requestId } } });

      return {
        contribution: contribution!,
        project: updatedProject,
        profile: fromPrismaProfile(finalProfile!),
        unlocked: didUnlock,
        contributorsAtUnlock
      };
    },

    claimBenefit: async ({ userId, projectId, profileAfter, events, now }) => {
      const project = await db.project.findUnique({ where: { id: projectId } });
      if (!project || project.unlockedAt === null) throw new Error('PROJECT_NOT_UNLOCKED');

      // Check if user is a contributor (self-benefit blocked at route level, but verify)
      const isContributor = await db.contribution.findFirst({ where: { projectId, userId } });
      if (isContributor) throw new Error('CONTRIBUTOR_CANNOT_CLAIM');

      try {
        const claim = await prisma.$transaction(async (txRaw) => {
          const tx = txRaw as AnyPrisma;
          const c = await tx.benefitClaim.create({
            data: { projectId, userId, unlockCycle: project.unlockCycle, createdAt: now }
          });

          await tx.profile.update({
            where: { userId },
            data: {
              archetype: profileAfter.archetype,
              level: profileAfter.level,
              profileXp: profileAfter.profileXp,
              archetypeXp: profileAfter.archetypeXp,
              energy: profileAfter.energy,
              softCurrency: profileAfter.softCurrency,
              reputation: profileAfter.reputation,
              energyUpdatedAt: profileAfter.energyUpdatedAt,
              updatedAt: now
            } as any
          });

          await tx.profileEvent.createMany({
            data: events.map((e) => ({
              userId: e.userId,
              eventType: toPrismaEventType(e.eventType),
              payload: toPrismaPayload(e.payload),
              createdAt: e.createdAt
            })) as any
          });

          return c;
        });

        // Give reputation to all distinct contributors
        const contribs = await db.contribution.findMany({
          where: { projectId },
          select: { userId: true },
          distinct: ['userId']
        });

        const repEvents = contribs.map((c) => ({
          userId: c.userId,
          eventType: 'reputation.gained' as ProfileEventType,
          payload: { reason: 'benefit_claimed', projectId, claimedBy: userId, delta: 2 },
          createdAt: now
        }));

        await writeEvents(repEvents);
        await (prisma as AnyPrisma).profile.updateMany({
          where: { userId: { in: contribs.map((c) => c.userId) } },
          data: { reputation: { increment: 2 } } as any
        });

        const finalProfile = await prisma.profile.findUnique({ where: { userId } });
        return {
          claim: { ...claim, createdAt: claim.createdAt },
          profile: fromPrismaProfile(finalProfile!)
        };
      } catch (err) {
        if (
          err instanceof Error &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          throw Object.assign(new Error('BENEFIT_ALREADY_CLAIMED'), { statusCode: 409 });
        }
        throw err;
      }
    },

    likeContribution: async ({ contributionId, fromUserId, now }) => {
      const contrib = await db.contribution.findUnique({ where: { id: contributionId } });
      if (!contrib) throw new Error('CONTRIBUTION_NOT_FOUND');

      try {
        const like = await db.contributionLike.create({
          data: { contributionId, fromUserId, createdAt: now }
        });

        await prisma.profile.update({
          where: { userId: contrib.userId },
          data: { reputation: { increment: REPUTATION_ON_LIKE } } as any
        });

        const project = await db.project.findUnique({ where: { id: contrib.projectId } });

        await writeEvents([
          {
            userId: contrib.userId,
            eventType: 'contribution.liked',
            payload: { contributionId, fromUserId, projectId: contrib.projectId, delta: REPUTATION_ON_LIKE },
            createdAt: now
          },
          {
            userId: contrib.userId,
            eventType: 'reputation.gained',
            payload: { reason: 'contribution_liked', contributionId, delta: REPUTATION_ON_LIKE },
            createdAt: now
          }
        ]);

        void project; // used for event payload context if needed later

        return { like, toUserId: contrib.userId };
      } catch (err) {
        if (
          err instanceof Error &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          throw Object.assign(new Error('ALREADY_LIKED'), { statusCode: 409 });
        }
        throw err;
      }
    },

    getContributionById: async (id) => {
      const c = await db.contribution.findUnique({ where: { id } });
      return c ?? null;
    },

    listFeed: async ({ limit, cursor }) => {
      const feedEventTypes = [
        'project_contributed',
        'project_unlocked',
        'benefit_claimed',
        'contribution_liked'
      ] as const;

      const events = await prisma.profileEvent.findMany({
        where: {
          eventType: { in: feedEventTypes as unknown as typeof feedEventTypes[number][] },
          ...(cursor ? { createdAt: { lt: cursor } } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { profile: { include: { user: true } } }
      });

      // Batch-load projects referenced in payloads
      const projectIds = [...new Set(
        events
          .map((e) => (e.payload as Record<string, unknown>).projectId as string | undefined)
          .filter((id): id is string => Boolean(id))
      )];

      const projectMap = new Map<string, { id: string; title: string }>();
      if (projectIds.length > 0) {
        const projects = await db.project.findMany({ where: { id: { in: projectIds } } });
        for (const p of projects) projectMap.set(p.id, p);
      }

      const items: FeedItem[] = [];

      for (const e of events) {
        const payload = e.payload as Record<string, unknown>;
        const userId = e.userId;
        const userFirstName = e.profile.user.firstName;
        const projectId = payload.projectId as string | undefined;
        const projectTitle = projectId ? (projectMap.get(projectId)?.title ?? '') : '';

        if (e.eventType === 'project_contributed' && projectId) {
          const contribId = (payload.contributionId as string | undefined) ?? e.id;
          items.push({
            kind: 'contribution',
            id: contribId,
            userId,
            userFirstName,
            projectId,
            projectTitle,
            amount: (payload.amount as number) ?? 1,
            createdAt: e.createdAt.toISOString()
          });
        } else if (e.eventType === 'project_unlocked' && projectId) {
          items.push({
            kind: 'unlock',
            id: e.id,
            userId,
            userFirstName,
            projectId,
            projectTitle,
            createdAt: e.createdAt.toISOString()
          });
        } else if (e.eventType === 'benefit_claimed' && projectId) {
          items.push({
            kind: 'benefit',
            id: e.id,
            userId,
            userFirstName,
            projectId,
            projectTitle,
            createdAt: e.createdAt.toISOString()
          });
        } else if (e.eventType === 'contribution_liked') {
          const contributionId = payload.contributionId as string | undefined;
          if (contributionId) {
            items.push({
              kind: 'like',
              id: e.id,
              userId,
              userFirstName,
              contributionId,
              projectTitle,
              createdAt: e.createdAt.toISOString()
            });
          }
        }
      }

      return items;
    },

    listProjectContributorIds: async (projectId) => {
      const contribs = await db.contribution.findMany({
        where: { projectId },
        select: { userId: true },
        distinct: ['userId']
      });
      return contribs.map((c) => c.userId);
    }
  };
}

// ─── In-memory store ──────────────────────────────────────────────────────────

export class InMemoryAppStore implements AppStore {
  private readonly usersById = new Map<string, PublicUser>();
  private readonly userIdsByTelegramId = new Map<number, string>();
  private readonly profilesByUserId = new Map<string, StoredProfile>();
  private readonly eventsByUserId = new Map<string, ProfileEventRecord[]>();
  private readonly projects = new Map<string, StoredProject>();
  private readonly contributions = new Map<string, StoredContribution>();
  private readonly contributionsByUserReqId = new Map<string, StoredContribution>();
  private readonly benefitClaims = new Map<string, StoredBenefitClaim>();
  private readonly likes = new Map<string, StoredContributionLike>();
  private readonly projectMutex = new Map<string, Promise<void>>();

  private nextProject(kind: 'notes' | 'gym' | 'festival', threshold: number, affinity: 'botan' | 'sportsman' | 'partygoer'): StoredProject {
    const id = randomUUID();
    const now = new Date();
    const title =
      kind === 'notes'
        ? 'Общие конспекты'
        : kind === 'gym'
          ? 'Кампусная качалка'
          : 'Сцена для движа';
    const description =
      kind === 'notes'
        ? 'Соберите общий архив конспектов, чтобы своим было проще готовиться к зачетам и экзаменам.'
        : kind === 'gym'
          ? 'Прокачайте зал, чтобы всем было проще держать форму, восстанавливаться и не сыпаться перед общими делами.'
          : 'Соберите сцену для движа, чтобы у всех появилось место, где можно собраться, пошуметь и словить общий вайб.';
    return {
      id, kind,
      title,
      description,
      threshold,
      progress: 0,
      affinity,
      unlockedAt: null,
      unlockCycle: 1,
      createdAt: now,
      updatedAt: now
    };
  }

  constructor() {
    const notes = this.nextProject('notes', 5, 'botan');
    const gym = this.nextProject('gym', 5, 'sportsman');
    const festival = this.nextProject('festival', 4, 'partygoer');
    this.projects.set(notes.id, notes);
    this.projects.set(gym.id, gym);
    this.projects.set(festival.id, festival);
  }

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
      return { createdProfile: false, player: { user, profile: existingProfile } };
    }

    const profile = getInitialProfile(user.id, now);
    this.profilesByUserId.set(user.id, profile);
    this.pushEvent({ userId: user.id, eventType: 'profile.created', payload: { origin: 'telegram_auth' }, createdAt: now });

    return { createdProfile: true, player: { user, profile } };
  }

  async findUserById(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async findPlayerByUserId(userId: string) {
    const user = this.usersById.get(userId);
    const profile = this.profilesByUserId.get(userId);
    if (!user || !profile) return null;
    return { user, profile };
  }

  async replaceProfile(userId: string, profile: StoredProfile, event?: Omit<ProfileEventRecord, 'id'>) {
    this.profilesByUserId.set(userId, profile);
    if (event) this.pushEvent(event);
    return profile;
  }

  async bumpReputation(userId: string, delta: number, event: Omit<ProfileEventRecord, 'id'>, now: Date) {
    const profile = this.profilesByUserId.get(userId);
    if (!profile) throw new Error('PROFILE_NOT_FOUND');
    const updated = applyReputationDelta(profile, delta, now);
    this.profilesByUserId.set(userId, updated);
    this.pushEvent(event);
    return updated;
  }

  async listEvents(userId: string) {
    return [...(this.eventsByUserId.get(userId) ?? [])];
  }

  async listProjects() {
    return [...this.projects.values()];
  }

  async getProjectById(id: string) {
    return this.projects.get(id) ?? null;
  }

  async contributeToProject(args: {
    userId: string;
    projectId: string;
    requestId: string;
    amount: number;
    actionId: string;
    profileAfter: StoredProfile;
    events: Omit<ProfileEventRecord, 'id'>[];
    now: Date;
  }): Promise<ContributeResult> {
    const { userId, projectId, requestId, amount, actionId, profileAfter, events, now } = args;

    // Idempotency
    const idempotencyKey = `${userId}:${requestId}`;
    const existing = this.contributionsByUserReqId.get(idempotencyKey);
    if (existing) {
      return {
        contribution: existing,
        project: this.projects.get(projectId)!,
        profile: this.profilesByUserId.get(userId)!,
        unlocked: this.projects.get(projectId)?.unlockedAt !== null
      };
    }

    // Serialize per project to avoid races
    const prevMutex = this.projectMutex.get(projectId) ?? Promise.resolve();
    let resolveMutex!: () => void;
    const nextMutex = new Promise<void>((resolve) => { resolveMutex = resolve; });
    this.projectMutex.set(projectId, prevMutex.then(() => nextMutex));

    await prevMutex;

    try {
      const project = this.projects.get(projectId);
      if (!project) throw new Error('PROJECT_NOT_FOUND');
      if (project.unlockedAt !== null) throw new Error('PROJECT_ALREADY_UNLOCKED');

      const newProgress = project.progress + amount;
      const unlocks = newProgress >= project.threshold;

      const updatedProject: StoredProject = {
        ...project,
        progress: newProgress,
        unlockedAt: unlocks ? now : null,
        updatedAt: now
      };
      this.projects.set(projectId, updatedProject);

      const contribution: StoredContribution = {
        id: randomUUID(),
        projectId,
        userId,
        actionId,
        amount,
        requestId,
        createdAt: now
      };
      this.contributions.set(contribution.id, contribution);
      this.contributionsByUserReqId.set(idempotencyKey, contribution);

      this.profilesByUserId.set(userId, profileAfter);
      for (const e of events) {
        const enriched = e.eventType === 'project.contributed'
          ? { ...e, payload: { ...e.payload, contributionId: contribution.id } }
          : e;
        this.pushEvent(enriched);
      }

      let contributorsAtUnlock: string[] | undefined;
      if (unlocks) {
        const contribUserIds = [...new Set(
          [...this.contributions.values()]
            .filter((c) => c.projectId === projectId)
            .map((c) => c.userId)
        )];
        contributorsAtUnlock = contribUserIds;

        this.pushEvent({ userId, eventType: 'project.unlocked', payload: { projectId, projectKind: project.kind }, createdAt: now });

        for (const cUserId of contribUserIds) {
          const p = this.profilesByUserId.get(cUserId);
          if (p) this.profilesByUserId.set(cUserId, applyReputationDelta(p, 3, now));
          this.pushEvent({ userId: cUserId, eventType: 'reputation.gained', payload: { reason: 'project_unlocked', projectId, delta: 3 }, createdAt: now });
        }
      }

      return {
        contribution,
        project: updatedProject,
        profile: this.profilesByUserId.get(userId)!,
        unlocked: unlocks,
        contributorsAtUnlock
      };
    } finally {
      resolveMutex();
    }
  }

  async claimBenefit(args: {
    userId: string;
    projectId: string;
    profileAfter: StoredProfile;
    events: Omit<ProfileEventRecord, 'id'>[];
    now: Date;
  }): Promise<{ claim: StoredBenefitClaim; profile: StoredProfile }> {
    const { userId, projectId, profileAfter, events, now } = args;
    const project = this.projects.get(projectId);
    if (!project || project.unlockedAt === null) throw new Error('PROJECT_NOT_UNLOCKED');

    const isContributor = [...this.contributions.values()].some(
      (c) => c.projectId === projectId && c.userId === userId
    );
    if (isContributor) throw new Error('CONTRIBUTOR_CANNOT_CLAIM');

    const claimKey = `${projectId}:${userId}:${project.unlockCycle}`;
    if (this.benefitClaims.has(claimKey)) {
      throw Object.assign(new Error('BENEFIT_ALREADY_CLAIMED'), { statusCode: 409 });
    }

    const claim: StoredBenefitClaim = { id: randomUUID(), projectId, userId, unlockCycle: project.unlockCycle, createdAt: now };
    this.benefitClaims.set(claimKey, claim);

    this.profilesByUserId.set(userId, profileAfter);
    for (const e of events) this.pushEvent(e);

    // Bump reputation for all distinct contributors
    const contributorIds = [...new Set(
      [...this.contributions.values()].filter((c) => c.projectId === projectId).map((c) => c.userId)
    )];
    for (const cUserId of contributorIds) {
      const p = this.profilesByUserId.get(cUserId);
      if (p) this.profilesByUserId.set(cUserId, applyReputationDelta(p, 2, now));
      this.pushEvent({ userId: cUserId, eventType: 'reputation.gained', payload: { reason: 'benefit_claimed', projectId, claimedBy: userId, delta: 2 }, createdAt: now });
    }

    return { claim, profile: this.profilesByUserId.get(userId)! };
  }

  async likeContribution(args: { contributionId: string; fromUserId: string; now: Date }) {
    const { contributionId, fromUserId, now } = args;
    const contrib = this.contributions.get(contributionId);
    if (!contrib) throw new Error('CONTRIBUTION_NOT_FOUND');

    const likeKey = `${contributionId}:${fromUserId}`;
    if (this.likes.has(likeKey)) {
      throw Object.assign(new Error('ALREADY_LIKED'), { statusCode: 409 });
    }

    const like: StoredContributionLike = { id: randomUUID(), contributionId, fromUserId, createdAt: now };
    this.likes.set(likeKey, like);

    const p = this.profilesByUserId.get(contrib.userId);
    if (p) this.profilesByUserId.set(contrib.userId, applyReputationDelta(p, REPUTATION_ON_LIKE, now));

    this.pushEvent({ userId: contrib.userId, eventType: 'contribution.liked', payload: { contributionId, fromUserId, delta: REPUTATION_ON_LIKE }, createdAt: now });
    this.pushEvent({ userId: contrib.userId, eventType: 'reputation.gained', payload: { reason: 'contribution_liked', contributionId, delta: REPUTATION_ON_LIKE }, createdAt: now });

    return { like, toUserId: contrib.userId };
  }

  async getContributionById(id: string) {
    return this.contributions.get(id) ?? null;
  }

  async listFeed(args: { limit: number; cursor?: Date }): Promise<FeedItem[]> {
    const { limit, cursor } = args;
    const feedTypes: ProfileEventType[] = ['project.contributed', 'project.unlocked', 'benefit.claimed', 'contribution.liked'];

    const allEvents: ProfileEventRecord[] = [];
    for (const events of this.eventsByUserId.values()) {
      for (const e of events) {
        if (feedTypes.includes(e.eventType)) {
          if (!cursor || e.createdAt < cursor) {
            allEvents.push(e);
          }
        }
      }
    }

    allEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const page = allEvents.slice(0, limit);

    const items: FeedItem[] = [];
    for (const e of page) {
      const user = this.usersById.get(e.userId);
      const userFirstName = user?.firstName ?? 'Кто-то';
      const payload = e.payload;
      const projectId = payload.projectId as string | undefined;
      const project = projectId ? this.projects.get(projectId) : undefined;
      const projectTitle = project?.title ?? '';

      if (e.eventType === 'project.contributed' && projectId) {
        const contribId = (payload.contributionId as string | undefined) ?? e.id;
        items.push({ kind: 'contribution', id: contribId, userId: e.userId, userFirstName, projectId, projectTitle, amount: (payload.amount as number) ?? 1, createdAt: e.createdAt.toISOString() });
      } else if (e.eventType === 'project.unlocked' && projectId) {
        items.push({ kind: 'unlock', id: e.id, userId: e.userId, userFirstName, projectId, projectTitle, createdAt: e.createdAt.toISOString() });
      } else if (e.eventType === 'benefit.claimed' && projectId) {
        items.push({ kind: 'benefit', id: e.id, userId: e.userId, userFirstName, projectId, projectTitle, createdAt: e.createdAt.toISOString() });
      } else if (e.eventType === 'contribution.liked') {
        const contributionId = payload.contributionId as string | undefined;
        if (contributionId) {
          items.push({ kind: 'like', id: e.id, userId: e.userId, userFirstName, contributionId, projectTitle, createdAt: e.createdAt.toISOString() });
        }
      }
    }

    return items;
  }

  async listProjectContributorIds(projectId: string) {
    return [...new Set(
      [...this.contributions.values()].filter((c) => c.projectId === projectId).map((c) => c.userId)
    )];
  }

  private pushEvent(event: Omit<ProfileEventRecord, 'id'>) {
    const events = this.eventsByUserId.get(event.userId) ?? [];
    events.push({ ...event, id: randomUUID() });
    this.eventsByUserId.set(event.userId, events);
  }
}
