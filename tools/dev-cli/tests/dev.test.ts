import { describe, expect, it } from 'vitest';
import { createDevLaunch, parseDevArguments } from '../src/dev';

describe('开发模式入口', () => {
  it('默认模式从仓库加载页面并注入 DQE Sim 端点', () => {
    const launch = createDevLaunch({
      profile: 'local',
      processEnv: { npm_execpath: '/pnpm.cjs' },
      execPath: '/node'
    });
    expect(launch.command).toBe('/node');
    expect(launch.args).toEqual([
      '/pnpm.cjs',
      '--parallel',
      '--filter',
      'canvas',
      '--filter',
      'platform',
      '--filter',
      '@metriccanvas/dqe-sim',
      'dev'
    ]);
    expect(launch.options.env).toMatchObject({
      VITE_PLATFORM_URL: '',
      VITE_DQE_ENDPOINT:
        'http://127.0.0.1:18228/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',
      VITE_AI_SUMMARY_ENDPOINT: 'http://127.0.0.1:18228/api/ai/conversations/'
    });
  });

  it('离线模式复用完整本地服务并切换平台存储', () => {
    const launch = createDevLaunch({
      profile: 'offline',
      processEnv: { npm_execpath: '/pnpm.cjs' },
      execPath: '/node'
    });
    expect(launch.command).toBe('/node');
    expect(launch.args).toEqual([
      '/pnpm.cjs',
      '--parallel',
      '--filter',
      'canvas',
      '--filter',
      'platform',
      '--filter',
      '@metriccanvas/dqe-sim',
      'dev'
    ]);
    expect(launch.options.env).toMatchObject({
      METRICCANVAS_OFFLINE: '1',
      VITE_PLATFORM_URL: 'http://localhost:5174'
    });
  });

  it('不再接受旧模拟数据服务参数', () => {
    expect(parseDevArguments(['local'])).toEqual({ profile: 'local' });
    expect(parseDevArguments(['offline'])).toEqual({ profile: 'offline' });
    expect(() => parseDevArguments(['sim'])).toThrow('用法:dev.ts <local|offline>');
  });
});
