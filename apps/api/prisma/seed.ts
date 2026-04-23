import { PrismaClient, type ProfileEventType, type ProjectKind } from './generated/client/index.js';

const prisma = new PrismaClient();

const projectSeeds: Array<{
  kind: ProjectKind;
  title: string;
  description: string;
  threshold: number;
  affinity: 'botan' | 'sportsman' | 'partygoer';
}> = [
  {
    kind: 'notes',
    title: 'Общие конспекты',
    description: 'Соберите общий архив конспектов, чтобы своим было проще готовиться к зачетам и экзаменам.',
    threshold: 5,
    affinity: 'botan'
  },
  {
    kind: 'gym',
    title: 'Кампусная качалка',
    description: 'Прокачайте зал, чтобы всем было проще держать форму, восстанавливаться и не сыпаться перед общими делами.',
    threshold: 5,
    affinity: 'sportsman'
  },
  {
    kind: 'festival',
    title: 'Сцена для движа',
    description: 'Соберите сцену для движа, чтобы у всех появилось место, где можно собраться, пошуметь и словить общий вайб.',
    threshold: 4,
    affinity: 'partygoer'
  }
];

const demoUsers = [
  {
    key: 'lera',
    telegramId: BigInt(99001),
    firstName: 'Лера',
    username: 'demo_lera',
    archetype: 'botan' as const,
    profileXp: 18,
    archetypeXp: 10,
    softCurrency: 3,
    reputation: 3
  },
  {
    key: 'max',
    telegramId: BigInt(99002),
    firstName: 'Макс',
    username: 'demo_max',
    archetype: 'sportsman' as const,
    profileXp: 12,
    archetypeXp: 7,
    softCurrency: 2,
    reputation: 2
  },
  {
    key: 'nika',
    telegramId: BigInt(99003),
    firstName: 'Ника',
    username: 'demo_nika',
    archetype: 'partygoer' as const,
    profileXp: 16,
    archetypeXp: 9,
    softCurrency: 2,
    reputation: 4
  }
] as const;

type DemoUserKey = (typeof demoUsers)[number]['key'];

function asPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function ensureBaseProjects() {
  for (const project of projectSeeds) {
    await prisma.project.upsert({
      where: { kind: project.kind },
      create: {
        kind: project.kind,
        title: project.title,
        description: project.description,
        threshold: project.threshold,
        affinity: project.affinity
      },
      update: {
        title: project.title,
        description: project.description,
        threshold: project.threshold,
        affinity: project.affinity
      }
    });
  }
}

async function ensureDemoUsers() {
  const userMap = new Map<DemoUserKey, { userId: string; firstName: string }>();

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { telegramId: demoUser.telegramId },
      create: {
        telegramId: demoUser.telegramId,
        firstName: demoUser.firstName,
        username: demoUser.username,
        languageCode: 'ru',
        writeAccessGranted: false,
        isSeededDemo: true
      },
      update: {
        firstName: demoUser.firstName,
        username: demoUser.username,
        languageCode: 'ru',
        writeAccessGranted: false,
        isSeededDemo: true
      }
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        archetype: demoUser.archetype,
        level: 1,
        profileXp: demoUser.profileXp,
        archetypeXp: demoUser.archetypeXp,
        energy: 3,
        softCurrency: demoUser.softCurrency,
        reputation: demoUser.reputation
      },
      update: {
        archetype: demoUser.archetype,
        level: 1,
        profileXp: demoUser.profileXp,
        archetypeXp: demoUser.archetypeXp,
        energy: 3,
        softCurrency: demoUser.softCurrency,
        reputation: demoUser.reputation
      }
    });

    userMap.set(demoUser.key, { userId: user.id, firstName: demoUser.firstName });
  }

  return userMap;
}

async function ensureSeedEvent(args: {
  userId: string;
  eventType: ProfileEventType;
  seedKey: string;
  createdAt: Date;
  payload: Record<string, unknown>;
}) {
  const existing = await prisma.profileEvent.findMany({
    where: { userId: args.userId, eventType: args.eventType },
    orderBy: { createdAt: 'asc' }
  });

  const match = existing.find((event) => asPayload(event.payload)?.seedKey === args.seedKey);
  if (match) {
    return match;
  }

  return prisma.profileEvent.create({
    data: {
      userId: args.userId,
      eventType: args.eventType,
      payload: {
        ...args.payload,
        seedKey: args.seedKey
      },
      createdAt: args.createdAt
    }
  });
}

async function ensureContribution(args: {
  projectKind: ProjectKind;
  userId: string;
  requestId: string;
  amount: number;
  createdAt: Date;
  seedKey: string;
}) {
  const project = await prisma.project.findUnique({ where: { kind: args.projectKind } });
  if (!project) {
    throw new Error(`Missing project seed for kind ${args.projectKind}`);
  }

  const existing = await prisma.contribution.findUnique({
    where: { userId_requestId: { userId: args.userId, requestId: args.requestId } }
  });
  if (existing) {
    return existing;
  }

  const nextProgress = project.progress + args.amount;
  const unlocksNow = project.unlockedAt === null && nextProgress >= project.threshold;

  const contribution = await prisma.contribution.create({
    data: {
      projectId: project.id,
      userId: args.userId,
      actionId: 'seed_demo',
      amount: args.amount,
      requestId: args.requestId,
      createdAt: args.createdAt
    }
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      progress: nextProgress,
      unlockedAt: unlocksNow ? args.createdAt : project.unlockedAt,
      updatedAt: args.createdAt
    }
  });

  await ensureSeedEvent({
    userId: args.userId,
    eventType: 'project_contributed',
    seedKey: args.seedKey,
    createdAt: args.createdAt,
    payload: {
      projectId: project.id,
      projectKind: project.kind,
      requestId: args.requestId,
      amount: args.amount,
      contributionId: contribution.id
    }
  });

  if (unlocksNow) {
    await ensureSeedEvent({
      userId: args.userId,
      eventType: 'project_unlocked',
      seedKey: `${args.seedKey}:unlock`,
      createdAt: args.createdAt,
      payload: {
        projectId: project.id,
        projectKind: project.kind
      }
    });
  }

  return contribution;
}

async function ensureBenefitClaim(args: {
  projectKind: ProjectKind;
  userId: string;
  createdAt: Date;
  seedKey: string;
}) {
  const project = await prisma.project.findUnique({ where: { kind: args.projectKind } });
  if (!project || project.unlockedAt === null) {
    throw new Error(`Project ${args.projectKind} must be unlocked before demo benefit claim`);
  }

  const existing = await prisma.benefitClaim.findUnique({
    where: {
      projectId_userId_unlockCycle: {
        projectId: project.id,
        userId: args.userId,
        unlockCycle: project.unlockCycle
      }
    }
  });

  const claim = existing ?? await prisma.benefitClaim.create({
    data: {
      projectId: project.id,
      userId: args.userId,
      unlockCycle: project.unlockCycle,
      createdAt: args.createdAt
    }
  });

  await ensureSeedEvent({
    userId: args.userId,
    eventType: 'benefit_claimed',
    seedKey: args.seedKey,
    createdAt: args.createdAt,
    payload: {
      projectId: project.id,
      projectKind: project.kind,
      claimId: claim.id
    }
  });

  return claim;
}

async function ensureLike(args: {
  contributionId: string;
  contributionOwnerId: string;
  fromUserId: string;
  projectKind: ProjectKind;
  createdAt: Date;
  seedKey: string;
}) {
  const project = await prisma.project.findUnique({ where: { kind: args.projectKind } });
  if (!project) {
    throw new Error(`Missing project ${args.projectKind} for demo like`);
  }

  const existing = await prisma.contributionLike.findFirst({
    where: {
      contributionId: args.contributionId,
      fromUserId: args.fromUserId
    }
  });

  const like = existing ?? await prisma.contributionLike.create({
    data: {
      contributionId: args.contributionId,
      fromUserId: args.fromUserId,
      createdAt: args.createdAt
    }
  });

  await ensureSeedEvent({
    userId: args.contributionOwnerId,
    eventType: 'contribution_liked',
    seedKey: args.seedKey,
    createdAt: args.createdAt,
    payload: {
      projectId: project.id,
      contributionId: args.contributionId,
      fromUserId: args.fromUserId,
      likeId: like.id
    }
  });

  return like;
}

async function ensureDemoWorld() {
  const users = await ensureDemoUsers();

  await ensureSeedEvent({
    userId: users.get('lera')!.userId,
    eventType: 'profile_created',
    seedKey: 'demo-user-lera',
    createdAt: new Date('2026-04-24T08:00:00.000Z'),
    payload: { origin: 'demo_seed' }
  });
  await ensureSeedEvent({
    userId: users.get('max')!.userId,
    eventType: 'profile_created',
    seedKey: 'demo-user-max',
    createdAt: new Date('2026-04-24T08:01:00.000Z'),
    payload: { origin: 'demo_seed' }
  });
  await ensureSeedEvent({
    userId: users.get('nika')!.userId,
    eventType: 'profile_created',
    seedKey: 'demo-user-nika',
    createdAt: new Date('2026-04-24T08:02:00.000Z'),
    payload: { origin: 'demo_seed' }
  });

  await ensureContribution({
    projectKind: 'notes',
    userId: users.get('lera')!.userId,
    requestId: 'demo-notes-lera-001',
    amount: 1,
    createdAt: new Date('2026-04-24T08:10:00.000Z'),
    seedKey: 'demo-notes-lera-001'
  });

  const festivalContributionA = await ensureContribution({
    projectKind: 'festival',
    userId: users.get('nika')!.userId,
    requestId: 'demo-festival-nika-001',
    amount: 1,
    createdAt: new Date('2026-04-24T08:15:00.000Z'),
    seedKey: 'demo-festival-nika-001'
  });

  await ensureContribution({
    projectKind: 'festival',
    userId: users.get('nika')!.userId,
    requestId: 'demo-festival-nika-002',
    amount: 1,
    createdAt: new Date('2026-04-24T08:20:00.000Z'),
    seedKey: 'demo-festival-nika-002'
  });

  await ensureContribution({
    projectKind: 'festival',
    userId: users.get('nika')!.userId,
    requestId: 'demo-festival-nika-003',
    amount: 1,
    createdAt: new Date('2026-04-24T08:25:00.000Z'),
    seedKey: 'demo-festival-nika-003'
  });

  await ensureContribution({
    projectKind: 'festival',
    userId: users.get('lera')!.userId,
    requestId: 'demo-festival-lera-001',
    amount: 1,
    createdAt: new Date('2026-04-24T08:30:00.000Z'),
    seedKey: 'demo-festival-lera-001'
  });

  await ensureBenefitClaim({
    projectKind: 'festival',
    userId: users.get('max')!.userId,
    createdAt: new Date('2026-04-24T08:40:00.000Z'),
    seedKey: 'demo-festival-benefit-max-001'
  });

  await ensureLike({
    contributionId: festivalContributionA.id,
    contributionOwnerId: users.get('nika')!.userId,
    fromUserId: users.get('lera')!.userId,
    projectKind: 'festival',
    createdAt: new Date('2026-04-24T08:45:00.000Z'),
    seedKey: 'demo-festival-like-lera-to-nika-001'
  });
}

async function main() {
  await ensureBaseProjects();
  await ensureDemoWorld();
  console.log('Seed complete: 3 campus projects upserted and demo world ensured.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
