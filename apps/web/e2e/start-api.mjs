import { execSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '../../api/prisma/generated/client/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..', '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function runPnpm(args) {
  execSync([pnpmCommand, ...args].join(' '), {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
    shell: true
  });
}

async function resetDatabase() {
  const prisma = new PrismaClient();

  try {
    await prisma.botNotification.deleteMany();
    await prisma.contributionLike.deleteMany();
    await prisma.benefitClaim.deleteMany();
    await prisma.contribution.deleteMany();
    await prisma.examReward.deleteMany();
    await prisma.examRun.deleteMany();
    await prisma.partyMember.deleteMany();
    await prisma.party.deleteMany();
    await prisma.profileEvent.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.project.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  runPnpm(['--filter', '@sharaga/api', 'prisma:migrate:deploy']);
  await resetDatabase();
  runPnpm(['--filter', '@sharaga/api', 'prisma:seed']);

  const child = spawn(pnpmCommand, ['--filter', '@sharaga/api', 'dev'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });

  const stopChild = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => stopChild('SIGINT'));
  process.on('SIGTERM', () => stopChild('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
