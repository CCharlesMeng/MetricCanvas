import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDevLaunch } from '../src/dev';

describe('跨平台开发启动器', () => {
  it('Windows 通过 Node 执行 pnpm 入口，不把环境变量写进 shell 命令', () => {
    const launch = createDevLaunch({
      profile: 'offline',
      platform: 'win32',
      execPath: 'C:\\Program Files\\nodejs\\node.exe',
      processEnv: {
        npm_execpath: 'C:\\Users\\developer\\AppData\\Local\\pnpm\\pnpm.cjs'
      }
    });

    expect(launch.command).toBe('C:\\Program Files\\nodejs\\node.exe');
    expect(launch.args).toEqual([
      'C:\\Users\\developer\\AppData\\Local\\pnpm\\pnpm.cjs',
      'dev'
    ]);
    expect(launch.options.shell).toBe(false);
    expect(launch.options.env).toMatchObject({
      METRICCANVAS_OFFLINE: '1',
      PLATFORM_ORIGIN: 'http://localhost:5174',
      RUNTIME_ORIGIN: 'http://localhost:5173',
      VITE_DATA_GATEWAY: 'mock',
      VITE_PLATFORM_URL: 'http://localhost:5174'
    });
  });

  it('仿真配置支持跨平台参数传递自定义数据服务地址', () => {
    const launch = createDevLaunch({
      profile: 'sim',
      platform: 'linux',
      execPath: '/usr/bin/node',
      processEnv: { npm_execpath: '/opt/pnpm/pnpm.cjs' },
      dataServiceUrl: 'http://data-service.internal:18226'
    });

    expect(launch.options.env).toMatchObject({
      VITE_DATA_GATEWAY: 'sim',
      VITE_DATA_SERVICE_URL: 'http://data-service.internal:18226'
    });
    expect(launch.options.env).not.toHaveProperty('METRICCANVAS_OFFLINE');
  });

  it('根脚本只调用 Node 启动器，不包含 POSIX 环境变量前缀', () => {
    const rootPackage = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../../../package.json', import.meta.url)),
        'utf8'
      )
    ) as { scripts: Record<string, string> };

    expect(rootPackage.scripts['dev:offline']).toBe(
      'tsx tools/dev-cli/src/dev.ts offline'
    );
    expect(rootPackage.scripts['dev:sim']).toBe(
      'tsx tools/dev-cli/src/dev.ts sim'
    );
    expect(rootPackage.scripts['dev:offline']).not.toMatch(/[A-Z][A-Z0-9_]*=/u);
  });
});
