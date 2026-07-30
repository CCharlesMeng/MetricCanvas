import { describe, expect, it } from 'vitest';
import canvasViteConfig from '../../../apps/canvas/vite.config';
import platformViteConfig from '../../../apps/platform/vite.config';

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
});
