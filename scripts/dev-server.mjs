import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const require = createRequire(import.meta.url);

function readDotEnv() {
  if (!existsSync('.env')) return {};

  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        return [key, value];
      }),
  );
}

const dotEnv = readDotEnv();
const port = process.env.PORT || dotEnv.PORT || '3000';
const hostname = process.env.HOSTNAME || dotEnv.HOSTNAME || '0.0.0.0';
const nextBin = require.resolve('next/dist/bin/next');
const defaultHeapMb = process.env.NODE_HEAP_MB || dotEnv.NODE_HEAP_MB || '4096';
const existingNodeOptions = [process.env.NODE_OPTIONS, dotEnv.NODE_OPTIONS]
  .filter(Boolean)
  .join(' ')
  .trim();
const nodeOptions = existingNodeOptions.includes('--max-old-space-size')
  ? existingNodeOptions
  : `${existingNodeOptions} --max-old-space-size=${defaultHeapMb}`.trim();
const nextArgs = [nextBin, mode, '--hostname', hostname, '--port', port];

// Turbopack is the stable default in Next.js 16 — no --webpack flag needed.

const child = spawn(
  process.execPath,
  nextArgs,
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...dotEnv,
      PORT: port,
      HOSTNAME: hostname,
      NODE_OPTIONS: nodeOptions,
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
