import Fastify from 'fastify';

import {
  contributeRequestSchema,
  queueForExamRequestSchema,
  performActionRequestSchema,
  setPartyReadyRequestSchema,
  selectArchetypeRequestSchema,
  type ActionId,
  type ApiError,
  type Archetype
} from '@sharaga/contracts';

import { validateTelegramInitData } from './auth.js';
import { signJwt, verifyJwt } from './jwt.js';
import {
  buildProfileResponse,
  performAction,
  refreshEnergy,
  selectArchetype,
  type StoredPlayer
} from './profile.js';
import {
  applyBenefitDelta,
  applyContributeDelta,
  computeContributionReward,
  CONTRIBUTE_ENERGY_COST
} from './social.js';
import type { StoredExamParty } from './exam.js';
import { createPrismaStore, type AppStore, type FeedCursor, type StoredExamRun } from './store.js';

type ErrorResponse = ApiError;

export type User = StoredPlayer['user'];

type AppConfig = {
  telegramBotToken: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  databaseUrl: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAppConfig(): AppConfig {
  return {
    telegramBotToken: getRequiredEnv('TELEGRAM_BOT_TOKEN'),
    jwtSecret: getRequiredEnv('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    databaseUrl: getRequiredEnv('DATABASE_URL')
  };
}

type BuildAppDependencies = {
  store?: AppStore;
  now?: () => Date;
};

function getErrorResponse(code: string, message: string, details?: unknown): ErrorResponse {
  return details ? { code, message, details } : { code, message };
}

function toPartyResponse(party: StoredExamParty) {
  return {
    id: party.id,
    ownerUserId: party.ownerUserId,
    capacity: party.capacity,
    status: party.status,
    memberCount: party.memberCount,
    members: party.members.map((member: StoredExamParty['members'][number]) => ({
      userId: member.userId,
      firstName: member.firstName,
      archetype: member.archetype,
      joinedAt: member.joinedAt.toISOString(),
      readyAt: member.readyAt?.toISOString() ?? null,
      isOwner: member.isOwner,
      isCurrentUser: member.isCurrentUser
    })),
    createdAt: party.createdAt.toISOString(),
    updatedAt: party.updatedAt.toISOString()
  };
}

function toRunResponse(run: StoredExamRun) {
  return {
    id: run.id,
    partyId: run.partyId,
    resolvedByUserId: run.resolvedByUserId,
    successChancePct: run.successChancePct,
    rollPct: run.rollPct,
    outcome: run.outcome,
    summary: run.summary,
    rewards: run.rewards.map((reward) => ({
      userId: reward.userId,
      profileXp: reward.profileXp,
      archetypeXp: reward.archetypeXp,
      softCurrency: reward.softCurrency,
      reputation: reward.reputation
    })),
    resolvedAt: run.resolvedAt.toISOString()
  };
}

function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      eventId: cursor.eventId
    }),
    'utf8'
  ).toString('base64url');
}

function decodeFeedCursor(value: string): FeedCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      createdAt?: unknown;
      eventId?: unknown;
    };

    if (typeof decoded.createdAt !== 'string' || typeof decoded.eventId !== 'string') {
      return null;
    }

    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      createdAt,
      eventId: decoded.eventId
    };
  } catch {
    return null;
  }
}

export function buildApp(config: AppConfig, dependencies: BuildAppDependencies = {}) {
  const app = Fastify({ logger: true });
  const store = dependencies.store ?? createPrismaStore(config.databaseUrl);
  const now = dependencies.now ?? (() => new Date());

  function getUnauthorizedResponse() {
    return getErrorResponse('UNAUTHORIZED', 'Токен авторизации отсутствует или недействителен');
  }

  async function authorizeRequest(
    request: { headers: { authorization?: string } },
    reply: { status: (code: number) => { send: (payload: ErrorResponse) => unknown } }
  ): Promise<User | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send(getUnauthorizedResponse());
      return null;
    }

    const token = authHeader.slice('Bearer '.length);
    const payload = verifyJwt(token, config.jwtSecret);
    if (!payload) {
      reply.status(401).send(getUnauthorizedResponse());
      return null;
    }

    const user = await store.findUserById(payload.sub);

    if (!user || user.telegramId !== payload.telegramId) {
      reply.status(401).send(getUnauthorizedResponse());
      return null;
    }

    return user;
  }

  app.setErrorHandler((error, _request, reply) => {
    const maybeValidation =
      typeof error === 'object' && error !== null && 'validation' in error
        ? (error as { validation?: unknown }).validation
        : undefined;

    if (maybeValidation) {
      return reply
        .status(400)
        .send(getErrorResponse('INVALID_REQUEST', 'Некорректные данные запроса', maybeValidation));
    }

    const message = error instanceof Error ? error.message : 'Произошла непредвиденная ошибка';

    return reply.status(500).send(getErrorResponse('INTERNAL_SERVER_ERROR', message));
  });

  app.addHook('onClose', async () => {
    await store.close?.();
  });

  app.get('/api/v1/health', async () => ({ status: 'ok' }));

  app.post('/api/v1/auth/telegram', async (request, reply) => {
    const body = request.body as { initData?: unknown };

    if (typeof body?.initData !== 'string' || body.initData.length === 0) {
      return reply.status(400).send({ code: 'INVALID_INIT_DATA', message: 'Нужно передать initData' });
    }

    let validated;
    try {
      validated = validateTelegramInitData(body.initData, config.telegramBotToken);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_SIGNATURE') {
        return reply.status(401).send(getErrorResponse('INVALID_SIGNATURE', 'Подпись Telegram initData недействительна'));
      }

      return reply.status(400).send(getErrorResponse('INVALID_INIT_DATA', 'Telegram initData некорректен'));
    }

    const authResult = await store.authenticateTelegramUser(validated.user, now());

    const accessToken = signJwt(
      { sub: authResult.player.user.id, telegramId: authResult.player.user.telegramId },
      config.jwtSecret,
      config.jwtExpiresIn
    );

    return { accessToken, user: authResult.player.user };
  });

  app.get('/api/v1/me', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) {
      return;
    }

    return user;
  });

  app.get('/api/v1/profile', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) {
      return;
    }

    const player = await store.findPlayerByUserId(user.id);
    if (!player) {
      return reply.status(404).send(getErrorResponse('PROFILE_NOT_FOUND', 'Профиль не найден'));
    }

    const currentTime = now();
    const refreshed = refreshEnergy(player.profile, currentTime);

    if (refreshed.changed) {
      player.profile = await store.replaceProfile(user.id, refreshed.profile);
    }

    return buildProfileResponse(player, currentTime);
  });

  app.post('/api/v1/class/select', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) {
      return;
    }

    const parsed = selectArchetypeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(getErrorResponse('INVALID_ARCHETYPE', 'Роль указана некорректно', parsed.error.flatten()));
    }

    const player = await store.findPlayerByUserId(user.id);
    if (!player) {
      return reply.status(404).send(getErrorResponse('PROFILE_NOT_FOUND', 'Профиль не найден'));
    }

    if (player.profile.archetype) {
      return reply
        .status(409)
        .send(getErrorResponse('ARCHETYPE_ALREADY_SELECTED', 'Роль уже выбрана'));
    }

    const currentTime = now();
    const refreshed = refreshEnergy(player.profile, currentTime);
    const selectedProfile = selectArchetype(refreshed.profile, parsed.data.archetype, currentTime);

    player.profile = await store.replaceProfile(user.id, selectedProfile, {
      userId: user.id,
      eventType: 'archetype.selected',
      payload: {
        archetype: parsed.data.archetype
      },
      createdAt: currentTime
    });

    return buildProfileResponse(player, currentTime);
  });

  app.post('/api/v1/actions/perform', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) {
      return;
    }

    const parsed = performActionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(getErrorResponse('INVALID_ACTION_ID', 'Действие указано некорректно', parsed.error.flatten()));
    }

    const player = await store.findPlayerByUserId(user.id);
    if (!player) {
      return reply.status(404).send(getErrorResponse('PROFILE_NOT_FOUND', 'Профиль не найден'));
    }

    const currentTime = now();
    const actionOutcome = performAction(player.profile, parsed.data.actionId as ActionId, currentTime);

    if ('errorCode' in actionOutcome) {
      if (actionOutcome.errorCode === 'ARCHETYPE_REQUIRED') {
        return reply.status(409).send(getErrorResponse('ARCHETYPE_REQUIRED', 'Сначала выбери роль'));
      }

      return reply.status(409).send(getErrorResponse('INSUFFICIENT_ENERGY', 'На это действие не хватает энергии'));
    }

    player.profile = await store.replaceProfile(user.id, actionOutcome.profile, {
      userId: user.id,
      eventType: 'action.performed',
      payload: {
        actionId: parsed.data.actionId,
        rewards: actionOutcome.result.rewards
      },
      createdAt: currentTime
    });

    return {
      ...buildProfileResponse(player, currentTime),
      result: actionOutcome.result
    };
  });

  // ─── BUILD-P2: Async Social World ──────────────────────────────────────────

  app.get('/api/v1/projects', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    const projects = await store.listProjects();
    const contributorIds = await Promise.all(projects.map((p) => store.listProjectContributorIds(p.id)));
    const claimsPerProject = await Promise.all(
      projects.map(async (p) => {
        const claimed = await store.listFeed({ limit: 1 }).then(() => false).catch(() => false);
        void claimed;
        return false;
      })
    );

    // Build user-specific contribution totals and claim status via feed
    const userContribsAndClaims = await Promise.all(
      projects.map(async (p, i) => {
        const allContribs = await store.listProjectContributorIds(p.id);
        const userHasContributed = allContribs.includes(user.id);

        // Check benefit claim: we look at events
        const events = await store.listEvents(user.id);
        const hasClaimed = events.some(
          (e) => e.eventType === 'benefit.claimed' && (e.payload.projectId as string) === p.id
        );

        void claimsPerProject[i];
        return {
          userContribution: userHasContributed ? 1 : 0,
          userHasClaimed: hasClaimed
        };
      })
    );

    return {
      projects: projects.map((p, i) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        description: p.description,
        threshold: p.threshold,
        progress: p.progress,
        unlocked: p.unlockedAt !== null,
        affinity: p.affinity,
        userContribution: userContribsAndClaims[i]?.userContribution ?? 0,
        userHasClaimed: userContribsAndClaims[i]?.userHasClaimed ?? false,
        contributorCount: contributorIds[i]?.length ?? 0
      }))
    };
  });

  app.post('/api/v1/projects/:id/contribute', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    const { id: projectId } = request.params as { id: string };

    const parsed = contributeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(getErrorResponse('INVALID_REQUEST', 'Некорректный запрос', parsed.error.flatten()));
    }

    const { requestId, amount } = parsed.data;

    const project = await store.getProjectById(projectId);
    if (!project) {
      return reply.status(404).send(getErrorResponse('PROJECT_NOT_FOUND', 'Проект не найден'));
    }

    if (project.unlockedAt !== null) {
      return reply.status(409).send(getErrorResponse('PROJECT_ALREADY_UNLOCKED', 'Этот проект уже открыт'));
    }

    const player = await store.findPlayerByUserId(user.id);
    if (!player) {
      return reply.status(404).send(getErrorResponse('PROFILE_NOT_FOUND', 'Профиль не найден'));
    }

    const currentTime = now();
    const refreshed = refreshEnergy(player.profile, currentTime);
    const currentProfile = refreshed.profile;

    if (!currentProfile.archetype) {
      return reply.status(409).send(getErrorResponse('ARCHETYPE_REQUIRED', 'Сначала выбери роль'));
    }

    if (currentProfile.energy < CONTRIBUTE_ENERGY_COST) {
      return reply.status(422).send(getErrorResponse('INSUFFICIENT_ENERGY', 'Не хватает энергии, чтобы вложиться в проект'));
    }

    const reward = computeContributionReward(currentProfile.archetype, project.affinity);
    const profileAfter = applyContributeDelta(currentProfile, reward, currentTime);

    try {
      const result = await store.contributeToProject({
        userId: user.id,
        projectId,
        requestId,
        amount,
        actionId: 'contribute',
        profileAfter,
        events: [
          {
            userId: user.id,
            eventType: 'project.contributed',
            payload: { projectId, projectKind: project.kind, amount, requestId },
            createdAt: currentTime
          }
        ],
        now: currentTime
      });

      return {
        profile: {
          userId: result.profile.userId,
          archetype: result.profile.archetype,
          level: result.profile.level,
          profileXp: result.profile.profileXp,
          archetypeXp: result.profile.archetypeXp,
          energy: result.profile.energy,
          softCurrency: result.profile.softCurrency,
          reputation: result.profile.reputation
        },
        project: {
          id: result.project.id,
          kind: result.project.kind,
          title: result.project.title,
          description: result.project.description,
          threshold: result.project.threshold,
          progress: result.project.progress,
          unlocked: result.project.unlockedAt !== null,
          affinity: result.project.affinity,
          userContribution: 1,
          userHasClaimed: false
        },
        contribution: {
          id: result.contribution.id,
          projectId: result.contribution.projectId,
          userId: result.contribution.userId,
          actionId: result.contribution.actionId,
          amount: result.contribution.amount,
          requestId: result.contribution.requestId,
          createdAt: result.contribution.createdAt.toISOString()
        },
        unlocked: result.unlocked
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'PROJECT_ALREADY_UNLOCKED') {
          return reply.status(409).send(getErrorResponse('PROJECT_ALREADY_UNLOCKED', 'Этот проект уже открыт'));
        }
        if ((err as { statusCode?: number }).statusCode === 503) {
          return reply.status(503).send(getErrorResponse('SERVICE_UNAVAILABLE', 'Не удалось обработать вклад, попробуй еще раз'));
        }
      }
      throw err;
    }
  });

  app.post('/api/v1/projects/:id/claim-benefit', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    const { id: projectId } = request.params as { id: string };

    const project = await store.getProjectById(projectId);
    if (!project) {
      return reply.status(404).send(getErrorResponse('PROJECT_NOT_FOUND', 'Проект не найден'));
    }

    if (project.unlockedAt === null) {
      return reply.status(403).send(getErrorResponse('PROJECT_NOT_UNLOCKED', 'Этот проект пока не открыт'));
    }

    const contributorIds = await store.listProjectContributorIds(projectId);
    if (contributorIds.includes(user.id)) {
      return reply.status(403).send(getErrorResponse('CONTRIBUTOR_CANNOT_CLAIM', 'Ты уже вкладывался в этот проект и не можешь забрать бонус'));
    }

    const player = await store.findPlayerByUserId(user.id);
    if (!player) {
      return reply.status(404).send(getErrorResponse('PROFILE_NOT_FOUND', 'Профиль не найден'));
    }

    const currentTime = now();
    const profileAfter = applyBenefitDelta(player.profile, currentTime);

    try {
      const result = await store.claimBenefit({
        userId: user.id,
        projectId,
        profileAfter,
        events: [
          {
            userId: user.id,
            eventType: 'benefit.claimed',
            payload: { projectId, projectKind: project.kind },
            createdAt: currentTime
          }
        ],
        now: currentTime
      });

      return {
        profile: {
          userId: result.profile.userId,
          archetype: result.profile.archetype,
          level: result.profile.level,
          profileXp: result.profile.profileXp,
          archetypeXp: result.profile.archetypeXp,
          energy: result.profile.energy,
          softCurrency: result.profile.softCurrency,
          reputation: result.profile.reputation
        },
        claim: {
          id: result.claim.id,
          projectId: result.claim.projectId,
          userId: result.claim.userId,
          unlockCycle: result.claim.unlockCycle,
          createdAt: result.claim.createdAt.toISOString()
        }
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'BENEFIT_ALREADY_CLAIMED' || (err as { statusCode?: number }).statusCode === 409) {
          return reply.status(409).send(getErrorResponse('BENEFIT_ALREADY_CLAIMED', 'Ты уже забрал бонус этого проекта'));
        }
        if (err.message === 'CONTRIBUTOR_CANNOT_CLAIM') {
          return reply.status(403).send(getErrorResponse('CONTRIBUTOR_CANNOT_CLAIM', 'Авторы вклада не могут забрать бонус своего проекта'));
        }
      }
      throw err;
    }
  });

  app.post('/api/v1/contributions/:id/like', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    const { id: contributionId } = request.params as { id: string };

    const contribution = await store.getContributionById(contributionId);
    if (!contribution) {
      return reply.status(404).send(getErrorResponse('CONTRIBUTION_NOT_FOUND', 'Вклад не найден'));
    }

    if (contribution.userId === user.id) {
      return reply.status(400).send(getErrorResponse('SELF_LIKE', 'Нельзя сказать спасибо самому себе'));
    }

    const currentTime = now();

    try {
      const result = await store.likeContribution({
        contributionId,
        fromUserId: user.id,
        now: currentTime
      });

      return {
        like: {
          id: result.like.id,
          contributionId: result.like.contributionId,
          fromUserId: result.like.fromUserId,
          createdAt: result.like.createdAt.toISOString()
        }
      };
    } catch (err) {
      if (err instanceof Error && (err.message === 'ALREADY_LIKED' || (err as { statusCode?: number }).statusCode === 409)) {
        return reply.status(409).send(getErrorResponse('ALREADY_LIKED', 'Ты уже сказал спасибо за этот вклад'));
      }
      throw err;
    }
  });

  app.get('/api/v1/exam', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    const state = await store.getExamState({ userId: user.id });
    return {
      exam: state.exam,
      party: state.party ? toPartyResponse(state.party) : null,
      latestRun: state.latestRun ? toRunResponse(state.latestRun) : null
    };
  });

  app.post('/api/v1/parties/queue', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    const parsed = queueForExamRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(getErrorResponse('INVALID_REQUEST', 'Размер пати указан некорректно', parsed.error.flatten()));
    }

    try {
      const party = await store.queueForExam({ userId: user.id, capacity: parsed.data.capacity, now: now() });
      return { party: toPartyResponse(party) };
    } catch (error) {
      if (error instanceof Error && error.message === 'ARCHETYPE_REQUIRED') {
        return reply.status(409).send(getErrorResponse('ARCHETYPE_REQUIRED', 'Сначала выбери роль'));
      }
      if (error instanceof Error && (error as { statusCode?: number }).statusCode === 503) {
        return reply.status(503).send(getErrorResponse('QUEUE_BUSY', 'Очередь сейчас перегружена, попробуй еще раз'));
      }
      throw error;
    }
  });

  app.post('/api/v1/parties/:id/ready', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    const parsed = setPartyReadyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(getErrorResponse('INVALID_REQUEST', 'Статус готовности указан некорректно', parsed.error.flatten()));
    }

    try {
      const result = await store.setPartyReady({
        partyId: (request.params as { id: string }).id,
        userId: user.id,
        ready: parsed.data.ready,
        now: now()
      });

      return {
        party: result.party ? toPartyResponse(result.party) : null,
        run: result.run ? toRunResponse(result.run) : null
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'PARTY_NOT_FOUND') {
        return reply.status(404).send(getErrorResponse('PARTY_NOT_FOUND', 'Пати не найдена'));
      }
      throw error;
    }
  });

  app.post('/api/v1/parties/:id/leave', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    try {
      const party = await store.leaveParty({
        partyId: (request.params as { id: string }).id,
        userId: user.id,
        now: now()
      });

      return { party: party ? toPartyResponse(party) : null };
    } catch (error) {
      if (error instanceof Error && error.message === 'PARTY_NOT_FOUND') {
        return reply.status(404).send(getErrorResponse('PARTY_NOT_FOUND', 'Пати не найдена'));
      }
      if (error instanceof Error && error.message === 'PARTY_NOT_ACTIVE') {
        return reply.status(409).send(getErrorResponse('PARTY_NOT_ACTIVE', 'Из этой пати уже нельзя выйти'));
      }
      throw error;
    }
  });

  app.get('/api/v1/feed', async (request, reply) => {
    const user = await authorizeRequest(request, reply);
    if (!user) return;

    const query = request.query as { limit?: string; cursor?: string };
    const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 50);
    const parsedCursor = query.cursor ? decodeFeedCursor(query.cursor) : null;

    if (query.cursor && !parsedCursor) {
      return reply.status(400).send(getErrorResponse('INVALID_CURSOR', 'Курсор ленты некорректен'));
    }

    const cursor = parsedCursor ?? undefined;
    const items = await store.listFeed({ limit: limit + 1, cursor });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const lastItem = page[page.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeFeedCursor({ createdAt: lastItem.createdAt, eventId: lastItem.cursorId })
        : null;

    return { items: page.map((entry) => entry.item), nextCursor };
  });

  return app;
}
