import { createHmac } from 'node:crypto';

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function calculateTelegramHash(dataCheckString, botToken) {
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

const botToken = getRequiredEnv('TELEGRAM_BOT_TOKEN');
const authDate = `${Math.floor(Date.now() / 1000)}`;

const user = {
  id: Number(process.env.TG_DEV_USER_ID ?? 42),
  first_name: process.env.TG_DEV_FIRST_NAME ?? 'Jane',
  username: process.env.TG_DEV_USERNAME ?? 'jane42'
};

const entries = [
  ['auth_date', authDate],
  ['query_id', process.env.TG_DEV_QUERY_ID ?? 'AAHdF6IQAAAAAN0XohDhrOrc'],
  ['user', JSON.stringify(user)]
];

const dataCheckString = entries
  .slice()
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

const hash = calculateTelegramHash(dataCheckString, botToken);
const params = new URLSearchParams();

for (const [key, value] of entries) {
  params.set(key, value);
}
params.set('hash', hash);

console.log(params.toString());
