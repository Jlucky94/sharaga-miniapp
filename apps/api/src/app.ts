import Fastify from 'fastify';

import {
  performActionRequestSchema,
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
import { createPrismaStore, type AppStore } from './store.js';

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

export function buildApp(config: AppConfig, dependencies: BuildAppDependencies = {}) {
  const app = Fastify({ logger: true });
  const store = dependencies.store ?? createPrismaStore(config.databaseUrl);
  const now = dependencies.now ?? (() => new Date());

  function getUnauthorizedResponse() {
    return getErrorResponse('UNAUTHORIZED', 'Authorization token is missing or invalid');
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
        .send(getErrorResponse('INVALID_REQUEST', 'Invalid request payload', maybeValidation));
    }

    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    return reply.status(500).send(getErrorResponse('INTERNAL_SERVER_ERROR', message));
  });

  app.addHook('onClose', async () => {
    await store.close?.();
  });

  app.get('/api/v1/health', async () => ({ status: 'ok' }));

  app.post('/api/v1/auth/telegram', async (request, reply) => {
    const body = request.body as { initData?: unknown };

    if (typeof body?.initData !== 'string' || body.initData.length === 0) {
      return reply.status(400).send({ code: 'INVALID_INIT_DATA', message: 'initData is required' });
    }

    let validated;
    try {
      validated = validateTelegramInitData(body.initData, config.telegramBotToken);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_SIGNATURE') {
        return reply.status(401).send(getErrorResponse('INVALID_SIGNATURE', 'Telegram initData signature is invalid'));
      }

      return reply.status(400).send(getErrorResponse('INVALID_INIT_DATA', 'Telegram initData is invalid'));
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
      return reply.status(404).send(getErrorResponse('PROFILE_NOT_FOUND', 'Profile was not found'));
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
      return reply.status(400).send(getErrorResponse('INVALID_ARCHETYPE', 'Archetype is invalid', parsed.error.flatten()));
    }

    const player = await store.findPlayerByUserId(user.id);
    if (!player) {
      return reply.status(404).send(getErrorResponse('PROFILE_NOT_FOUND', 'Profile was not found'));
    }

    if (player.profile.archetype) {
      return reply
        .status(409)
        .send(getErrorResponse('ARCHETYPE_ALREADY_SELECTED', 'Archetype is already selected'));
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
      return reply.status(400).send(getErrorResponse('INVALID_ACTION_ID', 'Action is invalid', parsed.error.flatten()));
    }

    const player = await store.findPlayerByUserId(user.id);
    if (!player) {
      return reply.status(404).send(getErrorResponse('PROFILE_NOT_FOUND', 'Profile was not found'));
    }

    const currentTime = now();
    const actionOutcome = performAction(player.profile, parsed.data.actionId as ActionId, currentTime);

    if ('errorCode' in actionOutcome) {
      if (actionOutcome.errorCode === 'ARCHETYPE_REQUIRED') {
        return reply.status(409).send(getErrorResponse('ARCHETYPE_REQUIRED', 'Choose an archetype before performing actions'));
      }

      return reply.status(409).send(getErrorResponse('INSUFFICIENT_ENERGY', 'Not enough energy for this action'));
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

  return app;
}
