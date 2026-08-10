import { spawn, type SpawnOptions } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DevProfile = 'local' | 'offline';

const DQE_SIM_ORIGIN = 'http://127.0.0.1:18228';
const DEV_SERVICES_ARGS = [
  '--parallel',
  '--filter',
  'canvas',
  '--filter',
  'platform',
  '--filter',
  '@metriccanvas/dqe-sim',
  'dev'
];

export interface CreateDevLaunchInput {
  profile: DevProfile;
  platform?: NodeJS.Platform;
  execPath?: string;
  processEnv?: NodeJS.ProcessEnv;
}

export interface DevLaunch {
  command: string;
  args: string[];
  options: SpawnOptions;
}

export function createDevLaunch({
  profile,
  platform = process.platform,
  execPath = process.execPath,
  processEnv = process.env
}: CreateDevLaunchInput): DevLaunch {
  const env: NodeJS.ProcessEnv = { ...processEnv };
  Object.assign(env, {
    PLATFORM_ORIGIN: 'http://localhost:5174',
    RUNTIME_ORIGIN: 'http://localhost:5173',
    VITE_PLATFORM_URL: profile === 'offline' ? 'http://localhost:5174' : '',
    VITE_DQE_ENDPOINT: `${DQE_SIM_ORIGIN}/rest/cdi/cdinl2databuilderservice/v1/dsl/execute`,
    VITE_AI_SUMMARY_ENDPOINT: `${DQE_SIM_ORIGIN}/api/ai/conversations/`
  });
  if (profile === 'offline') env.METRICCANVAS_OFFLINE = '1';
  else delete env.METRICCANVAS_OFFLINE;

  const pnpmEntry = processEnv.npm_execpath;
  const invocation = pnpmEntry
    ? { command: execPath, args: [pnpmEntry, ...DEV_SERVICES_ARGS] }
    : platform === 'win32'
      ? {
          command: processEnv.ComSpec ?? 'cmd.exe',
          args: ['/d', '/s', '/c', `pnpm ${DEV_SERVICES_ARGS.join(' ')}`]
        }
      : { command: 'pnpm', args: DEV_SERVICES_ARGS };

  return {
    ...invocation,
    options: { env, stdio: 'inherit', shell: false }
  };
}

export function parseDevArguments(argv: string[]): {
  profile: DevProfile;
} {
  const [profile, ...rest] = argv;
  if (profile !== 'local' && profile !== 'offline') {
    throw new Error('用法:dev.ts <local|offline>');
  }
  if (rest.some((argument) => argument !== '--')) {
    throw new Error(`未知参数:${rest.find((argument) => argument !== '--')}`);
  }
  return { profile };
}

export function run(argv = process.argv.slice(2)): void {
  try {
    const launch = createDevLaunch(parseDevArguments(argv));
    const child = spawn(launch.command, launch.args, launch.options);
    child.once('error', (error) => {
      console.error(`开发服务器启动失败:${error.message}`);
      process.exitCode = 1;
    });
    child.once('exit', (code) => {
      process.exitCode = code ?? 1;
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  run();
}
