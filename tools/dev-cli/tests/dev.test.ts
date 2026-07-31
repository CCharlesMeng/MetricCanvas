import { describe, expect, it } from 'vitest';
import { createDevLaunch, parseDevArguments } from '../src/dev';

describe('开发模式入口', () => {
  it('离线模式启动平台与 Canvas，静态页面无需数据网关', () => {
    const launch = createDevLaunch({
      profile: 'offline',
      processEnv: { npm_execpath: '/pnpm.cjs' },
      execPath: '/node'
    });
    expect(launch.command).toBe('/node');
    expect(launch.args).toEqual(['/pnpm.cjs', 'dev']);
    expect(launch.options.env).toMatchObject({
      METRICCANVAS_OFFLINE: '1',
      VITE_PLATFORM_URL: 'http://localhost:5174'
    });
  });

  it('不再接受旧模拟数据服务参数', () => {
    expect(parseDevArguments(['offline'])).toEqual({ profile: 'offline' });
    expect(() => parseDevArguments(['sim'])).toThrow('用法:dev.ts offline');
  });
});
