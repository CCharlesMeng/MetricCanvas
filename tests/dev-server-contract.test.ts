import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import playgroundViteConfig from '../apps/playground/vite.config';
import platformViteConfig from '../apps/platform/vite.config';
import { createDqeDevProxy } from '../tools/dev-server';
import { DEFAULT_DQE_SIM_HOST } from '../tools/dqe-sim/src/server';

const rootPackage = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')
) as { scripts: Record<string, string> };
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;

describe('本地开发服务端口契约', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(process, 'platform', platformDescriptor);
  });
  it('页面试验场固定占用 5173，端口冲突时禁止静默漂移', () => {
    expect(playgroundViteConfig).toMatchObject({
      server: { host: '0.0.0.0', port: 5173, strictPort: true }
    });
  });

  it('Mac 使用本地地址和 5174，端口冲突时禁止静默漂移', () => {
    Object.defineProperty(process, 'platform', {value: 'darwin'});
    const config = typeof platformViteConfig === 'function'
      ? platformViteConfig({
          command: 'serve',
          mode: 'development',
          isSsrBuild: false,
          isPreview: false
        })
      : platformViteConfig;
    expect(config).toMatchObject({
      server: { host: '127.0.0.1', port: 5174, strictPort: true }
    });
  });

  it('DQE 默认监听所有 IPv4 网卡，自定义端口只改变代理目标', () => {
    expect(DEFAULT_DQE_SIM_HOST).toBe('0.0.0.0');
    vi.stubEnv('DQE_SIM_PORT', '19228');
    expect(createDqeDevProxy()).toMatchObject({
      '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute': {
        target: 'http://127.0.0.1:19228'
      },
      '/api/ai/conversations/': { target: 'http://127.0.0.1:19228' }
    });
  });

  it('Windows 使用本地域名和 443，服务前缀统一代理到 IOC', () => {
    Object.defineProperty(process, 'platform', {value: 'win32'});
    const config = typeof platformViteConfig === 'function'
      ? platformViteConfig({command: 'serve', mode: 'development'}) : platformViteConfig;
    expect(config).toMatchObject({server: {
      host: 'local.cloudbu.huawei.com', port: 443, strictPort: true,
      proxy: {'/rest/cdi/cdinl2databuilderservice/': {target: 'https://ioc.cloudbu.huawei.com', changeOrigin: true}}
    }});
    expect(config).not.toHaveProperty('server.proxy./rest/cdi/cdinl2databuilderservice/v1/dsl/execute');
    expect(config).not.toHaveProperty('server.proxy./rest/cdi/cdinl2databuilderservice/v1/user-page-metadata');
    expect(rootPackage.scripts['dev:platform']).toBe('pnpm --filter platform dev');
    const platformPackage = JSON.parse(readFileSync(resolve(import.meta.dirname, '../apps/platform/package.json'), 'utf8'));
    expect(platformPackage.scripts.dev).toBe('vite dev');
  });

  it('默认开发命令直接启动 Platform 与 DQE Sim', () => {
    expect(rootPackage.scripts.dev).toBe(
      'pnpm --parallel --filter platform --filter @metriccanvas/dqe-sim dev'
    );
    expect(rootPackage.scripts['dev:offline']).toBeUndefined();
  });
});
