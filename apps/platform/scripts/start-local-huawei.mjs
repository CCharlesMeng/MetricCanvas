import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const port = process.argv[2] ?? '443';
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const vite = spawn(pnpm, ['exec', 'vite', 'dev'], {
  cwd: appRoot,
  env: {
    ...process.env,
    METRICCANVAS_LOCAL_HUAWEI: '1',
    METRICCANVAS_LOCAL_HUAWEI_PORT: port
  },
  stdio: 'inherit'
});

vite.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
