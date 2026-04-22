import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..');
const prismaCli = resolve(appDir, 'node_modules', 'prisma', 'build', 'index.js');
const generatedClientEntry = resolve(appDir, 'prisma', 'generated', 'client', 'index.js');
const baseArgs = [prismaCli, 'generate', '--schema', 'prisma/schema.prisma'];

function runGenerate(extraArgs = []) {
  return spawnSync(process.execPath, [...baseArgs, ...extraArgs], {
    cwd: appDir,
    encoding: 'utf8',
    stdio: 'pipe'
  });
}

function printOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

const firstAttempt = runGenerate();
printOutput(firstAttempt);

if (firstAttempt.status === 0) {
  process.exit(0);
}

const combinedOutput = `${firstAttempt.stdout ?? ''}\n${firstAttempt.stderr ?? ''}`;
const canFallback =
  process.platform === 'win32' &&
  combinedOutput.includes('EPERM') &&
  combinedOutput.includes('query_engine-windows.dll.node') &&
  existsSync(generatedClientEntry);

if (!canFallback) {
  process.exit(firstAttempt.status ?? 1);
}

console.warn('Prisma generate hit a locked Windows engine DLL; retrying with --no-engine against the existing generated client.');

const fallbackAttempt = runGenerate(['--no-engine']);
printOutput(fallbackAttempt);

process.exit(fallbackAttempt.status ?? 1);
