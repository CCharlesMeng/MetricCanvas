import { spawn, type SpawnOptions } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DevProfile = 'offline' | 'sim';

export interface CreateDevLaunchInput {
  profile: DevProfile;
  dataServiceUrl?: string;
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
  dataServiceUrl = 'http://localhost:18226',
  platform = process.platform,
  execPath = process.execPath,
  processEnv = process.env
}: CreateDevLaunchInput): DevLaunch {
  const env: NodeJS.ProcessEnv = { ...processEnv };
  if (profile === 'offline') {
    Object.assign(env, {
      METRICCANVAS_OFFLINE: '1',
      PLATFORM_ORIGIN: 'http://localhost:5174',
      RUNTIME_ORIGIN: 'http://localhost:5173',
      VITE_DATA_GATEWAY: 'mock',
      VITE_PLATFORM_URL: 'http://localhost:5174'
    });
  } else {
    delete env.METRICCANVAS_OFFLINE;
    Object.assign(env, {
      VITE_DATA_GATEWAY: 'sim',
      VITE_DATA_SERVICE_URL: dataServiceUrl
    });
  }

  const pnpmEntry = processEnv.npm_execpath;
  const invocation = pnpmEntry
    ? { command: execPath, args: [pnpmEntry, 'dev'] }
    : platform === 'win32'
      ? {
          command: processEnv.ComSpec ?? 'cmd.exe',
          args: ['/d', '/s', '/c', 'pnpm dev']
        }
      : { command: 'pnpm', args: ['dev'] };

  return {
    ...invocation,
    options: { env, stdio: 'inherit', shell: false }
  };
}

export function parseDevArguments(argv: string[]): {
  profile: DevProfile;
  dataServiceUrl?: string;
} {
  const [profile, ...rest] = argv;
  if (profile !== 'offline' && profile !== 'sim') {
    throw new Error('用法:dev.ts <offline|sim> [--data-service-url <url>]');
  }
  let dataServiceUrl: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--') continue;
    if (argument === '--data-service-url') {
      dataServiceUrl = rest[index + 1];
      index += 1;
      if (!dataServiceUrl) throw new Error('--data-service-url 缺少 URL');
      continue;
    }
    if (argument?.startsWith('--data-service-url=')) {
      dataServiceUrl = argument.slice('--data-service-url='.length);
      if (!dataServiceUrl) throw new Error('--data-service-url 缺少 URL');
      continue;
    }
    throw new Error(`未知参数:${argument}`);
  }
  return { profile, ...(dataServiceUrl ? { dataServiceUrl } : {}) };
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
