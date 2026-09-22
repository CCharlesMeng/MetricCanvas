import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import playgroundViteConfig from '../apps/playground/vite.config';
import platformViteConfig from '../apps/platform/vite.config';

const rootPackage = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')
) as { scripts: Record<string, string> };

describe('本地开发服务端口契约', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('页面试验场固定占用 5173，端口冲突时禁止静默漂移', () => {
    expect(playgroundViteConfig).toMatchObject({
      server: { port: 5173, strictPort: true }
    });
  });

  it.each([['', 443], ['5174', 5174]] as const)('Platform 使用 HTTPS 默认端口或显式覆盖 %s', (override, expectedPort) => {
    vi.stubEnv('METRICCANVAS_LOCAL_HUAWEI_PORT', override || undefined);
    const config = typeof platformViteConfig === 'function'
      ? platformViteConfig({
          command: 'serve',
          mode: 'development',
          isSsrBuild: false,
          isPreview: false
        })
      : platformViteConfig;
    expect(config).toMatchObject({
      server: { port: expectedPort, strictPort: true }
    });
  });

  it('默认开发命令直接启动 Platform 与 DQE Sim', () => {
    expect(rootPackage.scripts.dev).toBe(
      'pnpm --parallel --filter platform --filter @metriccanvas/dqe-sim dev'
    );
    expect(rootPackage.scripts['dev:offline']).toBeUndefined();
  });
});
