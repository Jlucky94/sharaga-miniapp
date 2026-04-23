import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appDir, '..', '..');
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/sharaga_miniapp';
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? 'playwright-test-token';
const jwtSecret = process.env.JWT_SECRET ?? 'playwright-jwt-secret';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    ...devices['Pixel 7']
  },
  webServer: [
    {
      command: 'node apps/web/e2e/telegram-stub.mjs',
      cwd: repoRoot,
      url: 'http://127.0.0.1:3002/health',
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'node apps/web/e2e/start-api.mjs',
      cwd: repoRoot,
      url: 'http://127.0.0.1:3001/api/v1/health',
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1d',
        TELEGRAM_BOT_TOKEN: telegramBotToken,
        TELEGRAM_BOT_API_BASE_URL: process.env.TELEGRAM_BOT_API_BASE_URL ?? 'http://127.0.0.1:3002',
        PORT: '3001'
      }
    },
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 3100',
      cwd: appDir,
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3100'
      }
    }
  ]
});
