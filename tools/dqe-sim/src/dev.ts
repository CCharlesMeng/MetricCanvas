import { spawn, type ChildProcess } from 'node:child_process';
import {
  createDqeSimServer,
  DEFAULT_DQE_SIM_HOST,
  DEFAULT_DQE_SIM_PORT,
  DQE_EXECUTE_PATH
} from './server';

const host = process.env.DQE_SIM_HOST ?? DEFAULT_DQE_SIM_HOST;
const port = Number(process.env.DQE_SIM_PORT ?? DEFAULT_DQE_SIM_PORT);
const endpoint = `http://${host}:${port}${DQE_EXECUTE_PATH}`;
const server = createDqeSimServer();
let playground: ChildProcess | undefined;
let stopping = false;

server.listen(port, host, () => {
  console.log(`DQE Sim 已就绪:${endpoint}`);
  const invocation = playgroundInvocation();
  playground = spawn(invocation.command, invocation.args, {
    stdio: 'inherit',
    shell: false,
    env: process.env
  });
  playground.once('error', (error) => {
    console.error(`页面试验场启动失败:${error.message}`);
    shutdown('SIGTERM', 1);
  });
  playground.once('exit', (code, signal) => {
    if (stopping) return;
    console.log(`页面试验场已退出:${signal ?? code ?? 'unknown'}`);
    shutdown('SIGTERM', code ?? 1);
  });
});

process.once('SIGINT', () => shutdown('SIGINT', 0));
process.once('SIGTERM', () => shutdown('SIGTERM', 0));

function playgroundInvocation(): { command: string; args: string[] } {
  const pnpmEntry = process.env.npm_execpath;
  if (pnpmEntry) {
    return {
      command: process.execPath,
      args: [pnpmEntry, '--filter', 'playground', 'dev']
    };
  }
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm --filter playground dev']
    };
  }
  return {
    command: 'pnpm',
    args: ['--filter', 'playground', 'dev']
  };
}

function shutdown(signal: NodeJS.Signals, exitCode: number): void {
  if (stopping) return;
  stopping = true;
  if (playground && !playground.killed) playground.kill(signal);
  server.close(() => {
    process.exitCode = exitCode;
  });
}
