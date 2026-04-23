import { createHmac } from 'node:crypto';

import { PrismaClient } from '../../api/prisma/generated/client/index.js';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

type TestUser = {
  telegramId: number;
  firstName: string;
  username: string;
};

type MiniAppSession = {
  context: BrowserContext;
  page: Page;
};

const prisma = new PrismaClient();
const botToken = process.env.TELEGRAM_BOT_TOKEN ?? 'playwright-test-token';
const apiBaseUrl = 'http://127.0.0.1:3001/api/v1';

const users = {
  fresh: { telegramId: 88001, firstName: 'Ася', username: 'asya_fresh' },
  socialA: { telegramId: 88011, firstName: 'Ира', username: 'ira_social' },
  socialB: { telegramId: 88012, firstName: 'Миша', username: 'misha_social' },
  examA: { telegramId: 88021, firstName: 'Аня', username: 'anya_exam' },
  examB: { telegramId: 88022, firstName: 'Боря', username: 'borya_exam' },
  examC: { telegramId: 88023, firstName: 'Сева', username: 'seva_exam' }
} as const satisfies Record<string, TestUser>;

const archetypeLabels = {
  botan: 'Ботан',
  sportsman: 'Спортик',
  partygoer: 'Тусовщик'
} as const;

function calculateTelegramHash(dataCheckString: string, token: string) {
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  return createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

function buildInitData(user: TestUser) {
  const entries: [string, string][] = [
    ['auth_date', `${Math.floor(Date.now() / 1000)}`],
    ['query_id', `q-${user.telegramId}`],
    ['user', JSON.stringify({
      id: user.telegramId,
      first_name: user.firstName,
      username: user.username,
      language_code: 'ru'
    })]
  ];

  const dataCheckString = entries
    .slice()
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.set(key, value);
  }
  params.set('hash', calculateTelegramHash(dataCheckString, botToken));

  return params.toString();
}

async function apiAuth(request: APIRequestContext, user: TestUser) {
  const response = await request.post(`${apiBaseUrl}/auth/telegram`, {
    data: {
      initData: buildInitData(user)
    }
  });

  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ accessToken: string; user: { id: string } }>;
}

async function apiSelectArchetype(request: APIRequestContext, accessToken: string, archetype: 'botan' | 'sportsman' | 'partygoer') {
  const response = await request.post(`${apiBaseUrl}/class/select`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      archetype
    }
  });

  expect(response.ok()).toBeTruthy();
}

async function apiGrantWriteAccess(request: APIRequestContext, accessToken: string) {
  const response = await request.post(`${apiBaseUrl}/notifications/write-access`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      granted: true
    }
  });

  expect(response.ok()).toBeTruthy();
}

async function apiExamState(request: APIRequestContext, accessToken: string) {
  const response = await request.get(`${apiBaseUrl}/exam`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ party: { id: string } | null }>;
}

async function apiReplayFinalReady(request: APIRequestContext, accessToken: string, partyId: string) {
  const response = await request.post(`${apiBaseUrl}/parties/${partyId}/ready`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      ready: true
    }
  });

  expect(response.ok()).toBeTruthy();
}

async function openMiniApp(browser: Browser, user: TestUser, writeAccessGranted = true): Promise<MiniAppSession> {
  const context = await browser.newContext();
  const initData = buildInitData(user);

  await context.addInitScript(({ telegramInitData, granted }) => {
    const requestWriteAccess = (callback?: (result: boolean) => void) => {
      if (typeof callback === 'function') {
        globalThis.setTimeout(() => callback(granted), 0);
        return;
      }

      return Promise.resolve(granted);
    };

    Object.defineProperty(globalThis, 'Telegram', {
      configurable: true,
      value: {
        WebApp: {
          initData: telegramInitData,
          initDataUnsafe: {},
          ready() {},
          expand() {},
          requestWriteAccess
        }
      }
    });
  }, { telegramInitData: initData, granted: writeAccessGranted });

  const page = await context.newPage();
  await page.goto('/');

  return { context, page };
}

async function ensureArchetype(page: Page, archetype: 'botan' | 'sportsman' | 'partygoer') {
  const pickerButton = page.getByRole('button', { name: `Выбрать ${archetypeLabels[archetype]}` });
  const homeTab = page.getByRole('button', { name: 'Главная' });

  await Promise.race([
    homeTab.waitFor({ state: 'visible' }),
    pickerButton.waitFor({ state: 'visible' })
  ]);

  if (await pickerButton.isVisible()) {
    await pickerButton.click();
  }
}

async function waitForMainShell(page: Page) {
  await expect(page.getByRole('button', { name: 'Главная' })).toBeVisible();
}

async function closeSessions(...sessions: MiniAppSession[]) {
  await Promise.all(sessions.map(async ({ context }) => {
    await context.close();
  }));
}

test.describe.configure({ mode: 'serial' });

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('first value path shows write-access CTA and demo feed immediately after entry', async ({ browser, request }) => {
  const session = await openMiniApp(browser, users.fresh, true);

  try {
    await ensureArchetype(session.page, 'botan');
    await waitForMainShell(session.page);

    await expect(session.page.getByText('Короткий цикл на сегодня')).toBeVisible();

    await session.page.locator('.action-card--recommended').getByRole('button', { name: 'Сделать' }).click();

    await expect(session.page.getByText('Не пропусти движ после первого результата')).toBeVisible();
    await session.page.getByRole('button', { name: 'Включить уведомления' }).click();
    await expect(session.page.getByRole('button', { name: 'Включить уведомления' })).toHaveCount(0);

    const auth = await apiAuth(request, users.fresh);
    const profileResponse = await request.get(`${apiBaseUrl}/profile`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`
      }
    });
    const profile = await profileResponse.json() as { writeAccessGranted: boolean };
    expect(profile.writeAccessGranted).toBe(true);

    await session.page.getByRole('button', { name: 'Лента' }).click();
    await expect(session.page.getByText('Часть активности помечена как демо')).toBeVisible();
    await expect(session.page.getByText('Демо').first()).toBeVisible();

    const confirmation = await prisma.botNotification.findMany({
      where: {
        kind: 'write_access_confirmed',
        user: {
          telegramId: BigInt(users.fresh.telegramId)
        }
      }
    });
    expect(confirmation).toHaveLength(1);
    expect(confirmation[0]?.status).toBe('sent');
  } finally {
    await closeSessions(session);
  }
});

test('two-user social smoke keeps contribution visible and triggers one social notification', async ({ browser, request }) => {
  const authA = await apiAuth(request, users.socialA);
  const authB = await apiAuth(request, users.socialB);
  await apiSelectArchetype(request, authA.accessToken, 'sportsman');
  await apiSelectArchetype(request, authB.accessToken, 'partygoer');
  await apiGrantWriteAccess(request, authA.accessToken);

  const sessionA = await openMiniApp(browser, users.socialA);
  const sessionB = await openMiniApp(browser, users.socialB);

  try {
    await waitForMainShell(sessionA.page);
    await waitForMainShell(sessionB.page);

    await sessionA.page.getByRole('button', { name: 'Проекты' }).click();
    const notesCard = sessionA.page.locator('.card').filter({ has: sessionA.page.getByRole('heading', { name: 'Общие конспекты' }) });
    await notesCard.getByRole('button', { name: 'Вложиться' }).click();
    await expect(notesCard.getByText('2 / 5 вкладов')).toBeVisible();

    await sessionB.page.getByRole('button', { name: 'Лента' }).click();
    const socialRow = sessionB.page.locator('.feed-item').filter({ hasText: `${users.socialA.firstName} вложился в Общие конспекты` }).first();
    await expect(socialRow).toBeVisible();
    await socialRow.getByRole('button', { name: 'Сказать спасибо' }).click();
    await expect(socialRow.getByText('Спасибо отправлено')).toBeVisible();

    await expect.poll(async () => prisma.botNotification.count({
      where: {
        kind: 'social_payoff',
        user: {
          telegramId: BigInt(users.socialA.telegramId)
        }
      }
    })).toBe(1);

    const notification = await prisma.botNotification.findFirst({
      where: {
        kind: 'social_payoff',
        user: {
          telegramId: BigInt(users.socialA.telegramId)
        }
      }
    });
    expect(notification?.status).toBe('sent');
  } finally {
    await closeSessions(sessionA, sessionB);
  }
});

test('three-user exam smoke resolves once and keeps exam notifications deduped on replay', async ({ browser, request }) => {
  const authA = await apiAuth(request, users.examA);
  const authB = await apiAuth(request, users.examB);
  const authC = await apiAuth(request, users.examC);

  await apiSelectArchetype(request, authA.accessToken, 'botan');
  await apiSelectArchetype(request, authB.accessToken, 'sportsman');
  await apiSelectArchetype(request, authC.accessToken, 'partygoer');
  await apiGrantWriteAccess(request, authA.accessToken);
  await apiGrantWriteAccess(request, authB.accessToken);
  await apiGrantWriteAccess(request, authC.accessToken);

  const sessionA = await openMiniApp(browser, users.examA);
  const sessionB = await openMiniApp(browser, users.examB);
  const sessionC = await openMiniApp(browser, users.examC);

  try {
    await Promise.all([
      waitForMainShell(sessionA.page),
      waitForMainShell(sessionB.page),
      waitForMainShell(sessionC.page)
    ]);

    await Promise.all([
      sessionA.page.getByRole('button', { name: 'Экзамен' }).click(),
      sessionB.page.getByRole('button', { name: 'Экзамен' }).click(),
      sessionC.page.getByRole('button', { name: 'Экзамен' }).click()
    ]);

    await sessionA.page.getByRole('button', { name: 'Встать в очередь' }).click();
    await sessionB.page.getByRole('button', { name: 'Встать в очередь' }).click();
    await sessionC.page.getByRole('button', { name: 'Встать в очередь' }).click();

    await Promise.all([
      expect(sessionA.page.getByRole('button', { name: 'Я готов' })).toBeVisible(),
      expect(sessionB.page.getByRole('button', { name: 'Я готов' })).toBeVisible(),
      expect(sessionC.page.getByRole('button', { name: 'Я готов' })).toBeVisible()
    ]);

    const partyState = await apiExamState(request, authA.accessToken);
    expect(partyState.party?.id).toBeTruthy();
    const partyId = partyState.party!.id;

    await sessionA.page.getByRole('button', { name: 'Я готов' }).click();
    await sessionB.page.getByRole('button', { name: 'Я готов' }).click();
    await sessionC.page.getByRole('button', { name: 'Я готов' }).click();

    await expect(sessionC.page.getByRole('heading', { name: 'Последний результат' })).toBeVisible();
    await expect(sessionC.page.getByText(/Шанс:/)).toBeVisible();

    await apiReplayFinalReady(request, authC.accessToken, partyId);

    for (const user of [users.examA, users.examB, users.examC]) {
      const readyNotifications = await prisma.botNotification.findMany({
        where: {
          kind: 'exam_update',
          user: {
            telegramId: BigInt(user.telegramId)
          }
        }
      });
      expect(readyNotifications).toHaveLength(1);
      expect(readyNotifications[0]?.status).toBe('sent');

      const resultNotifications = await prisma.botNotification.findMany({
        where: {
          kind: 'exam_result',
          user: {
            telegramId: BigInt(user.telegramId)
          }
        }
      });
      expect(resultNotifications).toHaveLength(1);
      expect(resultNotifications[0]?.status).toBe('sent');
    }
  } finally {
    await closeSessions(sessionA, sessionB, sessionC);
  }
});
