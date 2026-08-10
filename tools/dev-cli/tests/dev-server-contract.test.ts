import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import canvasViteConfig from '../../../apps/canvas/vite.config';
import platformViteConfig from '../../../apps/platform/vite.config';

const rootPackage = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../package.json'), 'utf8')
) as { scripts: Record<string, string> };

describe('本地开发服务端口契约', () => {
  it('Canvas 固定占用 5173，端口冲突时禁止静默漂移', () => {
    expect(canvasViteConfig).toMatchObject({
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

  it('默认开发命令同时启动 Canvas、Platform 和 DQE Sim', () => {
    expect(rootPackage.scripts.dev).toBe('tsx tools/dev-cli/src/dev.ts local');
  });
});
