import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import playgroundViteConfig from '../../../apps/playground/vite.config';
import platformViteConfig from '../../../apps/platform/vite.config';

const rootPackage = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../package.json'), 'utf8')
) as { scripts: Record<string, string> };

describe('本地开发服务端口契约', () => {
  it('页面试验场固定占用 5173，端口冲突时禁止静默漂移', () => {
    expect(playgroundViteConfig).toMatchObject({
      server: {
        port: 5173,
        strictPort: true
      }
    });
  });

  it('Platform 固定占用 5174，端口冲突时禁止静默漂移', () => {
    expect(platformViteConfig).toMatchObject({
      server: {
        port: 5174,
        strictPort: true
      }
    });
  });

  it('默认开发命令使用平台与 DQE Sim 启动器', () => {
    expect(rootPackage.scripts.dev).toBe('tsx tools/dev-cli/src/dev.ts local');
  });
});
