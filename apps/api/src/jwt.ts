import { createHmac, timingSafeEqual } from 'node:crypto';

type JwtPayload = {
  sub: string;
  telegramId: number;
  exp: number;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    return 60 * 60 * 24;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return amount * multiplier;
}

function signPart(data: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(data).digest());
}

export function signJwt(payload: Omit<JwtPayload, 'exp'>, secret: string, expiresIn: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + parseDurationToSeconds(expiresIn);
  const fullPayload: JwtPayload = {
    ...payload,
    exp
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signPart(signingInput, secret);

  return `${signingInput}.${signature}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const signature = parts[2];
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signPart(signingInput, secret);

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as JwtPayload;

    if (!payload.sub || !payload.telegramId || !payload.exp) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
