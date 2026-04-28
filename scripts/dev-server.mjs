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

const child = spawn(
  process.execPath,
  [nextBin, mode, '--hostname', hostname, '--port', port],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...dotEnv,
      PORT: port,
      HOSTNAME: hostname,
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
