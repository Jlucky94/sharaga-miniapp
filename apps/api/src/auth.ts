import { createHmac, timingSafeEqual } from 'node:crypto';

export type TelegramUserPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

export type ValidatedInitData = {
  user: TelegramUserPayload;
};

const MAX_AUTH_AGE_SECONDS = 60 * 60 * 24;

function getTelegramSecretKey(botToken: string): Buffer {
  return createHmac('sha256', 'WebAppData').update(botToken).digest();
}

export function calculateTelegramHash(dataCheckString: string, botToken: string): string {
  const secret = getTelegramSecretKey(botToken);
  return createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(receivedHex, 'hex');

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export function validateTelegramInitData(initData: string, botToken: string): ValidatedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new Error('INVALID_INIT_DATA');
  }

  const entries = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');
  const expectedHash = calculateTelegramHash(dataCheckString, botToken);

  if (!safeEqualHex(expectedHash, hash)) {
    throw new Error('INVALID_SIGNATURE');
  }

  const authDate = params.get('auth_date');
  if (!authDate || Number.isNaN(Number(authDate))) {
    throw new Error('INVALID_INIT_DATA');
  }

  const age = Math.floor(Date.now() / 1000) - Number(authDate);
  if (age > MAX_AUTH_AGE_SECONDS) {
    throw new Error('INVALID_INIT_DATA');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new Error('INVALID_INIT_DATA');
  }

  let user: TelegramUserPayload;
  try {
    user = JSON.parse(userRaw) as TelegramUserPayload;
  } catch {
    throw new Error('INVALID_INIT_DATA');
  }

  if (!user.id || !user.first_name) {
    throw new Error('INVALID_INIT_DATA');
  }

  return { user };
}
