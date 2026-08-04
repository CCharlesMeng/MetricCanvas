import { spawn, type ChildProcess } from 'node:child_process';
import {
  AI_SUMMARY_CONVERSATIONS_PATH,
  createDqeSimServer,
  DEFAULT_DQE_SIM_PORT,
  DQE_EXECUTE_PATH
} from './server';

const host = '127.0.0.1';
const port = Number(process.env.DQE_SIM_PORT ?? DEFAULT_DQE_SIM_PORT);
const endpoint = `http://${host}:${port}${DQE_EXECUTE_PATH}`;
const aiSummaryEndpoint = `http://${host}:${port}${AI_SUMMARY_CONVERSATIONS_PATH}`;
const server = createDqeSimServer();
let canvas: ChildProcess | undefined;
let stopping = false;

server.listen(port, host, () => {
  console.log(`DQE Sim 已就绪:${endpoint}`);
  console.log(`AI Summary Sim 已就绪:${aiSummaryEndpoint}`);
  const invocation = canvasInvocation();
  canvas = spawn(invocation.command, invocation.args, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      VITE_PLATFORM_URL: '',
      VITE_DQE_ENDPOINT: endpoint,
      VITE_AI_SUMMARY_ENDPOINT: aiSummaryEndpoint
    }
  });
  canvas.once('error', (error) => {
    console.error(`Canvas 启动失败:${error.message}`);
    shutdown('SIGTERM', 1);
  });
  canvas.once('exit', (code, signal) => {
    if (stopping) return;
    console.log(`Canvas 已退出:${signal ?? code ?? 'unknown'}`);
    shutdown('SIGTERM', code ?? 1);
  });
});

process.once('SIGINT', () => shutdown('SIGINT', 0));
process.once('SIGTERM', () => shutdown('SIGTERM', 0));

function canvasInvocation(): { command: string; args: string[] } {
  const pnpmEntry = process.env.npm_execpath;
  if (pnpmEntry) {
    return {
      command: process.execPath,
      args: [pnpmEntry, '--filter', 'canvas', 'dev', '--host', host]
    };
  }
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', `pnpm --filter canvas dev --host ${host}`]
    };
  }
  return {
    command: 'pnpm',
    args: ['--filter', 'canvas', 'dev', '--host', host]
  };
}

function shutdown(signal: NodeJS.Signals, exitCode: number): void {
  if (stopping) return;
  stopping = true;
  if (canvas && !canvas.killed) canvas.kill(signal);
  server.close(() => {
    process.exitCode = exitCode;
  });
}
