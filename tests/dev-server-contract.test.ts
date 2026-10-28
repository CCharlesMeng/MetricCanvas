import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import playgroundViteConfig from '../apps/playground/vite.config';
import platformViteConfig from '../apps/platform/vite.config';
import { createDqeDevProxy, readCloudIocDevConfig } from '../tools/dev-server';
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
    Object.defineProperty(process, 'platform', {value: 'darwin'});
    const config = typeof playgroundViteConfig === 'function'
      ? playgroundViteConfig({command: 'serve', mode: 'development'}) : playgroundViteConfig;
    expect(config).toMatchObject({
      server: { host: '0.0.0.0', port: 5173, strictPort: true }
    });
  });

  it('Windows 开启配置后使用 HTTPS 插件和 443，浏览器及 DQE 代理携带 cftk 到 gray', () => {
    Object.defineProperty(process, 'platform', {value: 'win32'});
    vi.stubEnv('PLAYGROUND_CLOUDIOC', 'true');
    vi.stubEnv('PLAYGROUND_CLOUDIOC_CFTK', ' copied-cftk ');
    const config = typeof playgroundViteConfig === 'function'
      ? playgroundViteConfig({command: 'serve', mode: 'development'}) : playgroundViteConfig;
    expect(config).toMatchObject({server: {
      host: 'local.cloudioc.huawei.com', port: 443, strictPort: true,
      proxy: {
        '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute': {
          target: 'https://gray.cloudioc.huawei.com', changeOrigin: true, secure: false, headers: {cftk: 'copied-cftk'}
        },
        '/api/ai/conversations/': {target: expect.stringContaining('http://127.0.0.1:')}
      }
    }});
    expect(config.plugins).toEqual(expect.arrayContaining([expect.objectContaining({name: 'vite:basic-ssl'})]));
    expect(config.define).toEqual({'import.meta.env.PLAYGROUND_CLOUDIOC_CFTK': JSON.stringify('copied-cftk')});
    expect(config.server?.proxy?.['/api/ai/conversations/']).not.toHaveProperty('headers');
  });

  it.each(['', ' \n ' , 'invalid\r\nheader'])('Windows 启用但 cftk 无效时拒绝启动，错误不泄露凭据', (cftk) => {
    Object.defineProperty(process, 'platform', {value: 'win32'});
    vi.stubEnv('PLAYGROUND_CLOUDIOC', 'true');
    vi.stubEnv('PLAYGROUND_CLOUDIOC_CFTK', cftk);
    expect(() => typeof playgroundViteConfig === 'function'
      ? playgroundViteConfig({command: 'serve', mode: 'development'}) : playgroundViteConfig
    ).toThrow('请在 apps/playground/.env.local 中填写有效的 PLAYGROUND_CLOUDIOC_CFTK');
  });

  it.each([
    {platform: 'darwin', command: 'serve' as const, enabled: 'true', isPreview: false},
    {platform: 'linux', command: 'serve' as const, enabled: 'true', isPreview: false},
    {platform: 'win32', command: 'serve' as const, enabled: 'false', isPreview: false},
    {platform: 'win32', command: 'build' as const, enabled: 'true', isPreview: false},
    {platform: 'win32', command: 'serve' as const, enabled: 'true', isPreview: true}
  ])('页面试验场隔离环境配置：$platform / $command / enabled=$enabled / preview=$isPreview', ({platform, command, enabled, isPreview}) => {
    Object.defineProperty(process, 'platform', {value: platform});
    vi.stubEnv('PLAYGROUND_CLOUDIOC', enabled);
    vi.stubEnv('PLAYGROUND_CLOUDIOC_CFTK', '');
    const config = typeof playgroundViteConfig === 'function'
      ? playgroundViteConfig({command, mode: 'development', isPreview}) : playgroundViteConfig;
    expect(config).toMatchObject({server: {
      host: '0.0.0.0', port: 5173,
      proxy: {'/rest/cdi/cdinl2databuilderservice/v1/dsl/execute': {
        target: expect.stringContaining('http://127.0.0.1:')
      }}
    }});
    expect(config.server?.proxy?.['/rest/cdi/cdinl2databuilderservice/v1/dsl/execute']).not.toHaveProperty('headers');
    expect(config).not.toHaveProperty('define');
    expect(config.plugins).not.toEqual(expect.arrayContaining([expect.objectContaining({name: 'vite:basic-ssl'})]));
  });

  it.each(['darwin', 'linux', 'win32'])('Platform 在 %s 使用 localhost 和 5174，端口冲突时禁止静默漂移', (platform) => {
    Object.defineProperty(process, 'platform', {value: platform});
    vi.stubEnv('PLATFORM_CLOUDIOC', 'false');
    const config = typeof platformViteConfig === 'function'
      ? platformViteConfig({
          command: 'serve',
          mode: 'development',
          isSsrBuild: false,
          isPreview: false
        })
      : platformViteConfig;
    expect(config).toMatchObject({
      server: { host: 'localhost', port: 5174, strictPort: true }
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

  it('Windows 使用 localhost 和普通端口，服务前缀统一代理到 IOC', () => {
    Object.defineProperty(process, 'platform', {value: 'win32'});
    vi.stubEnv('PLATFORM_CLOUDIOC', 'false');
    const config = typeof platformViteConfig === 'function'
      ? platformViteConfig({command: 'serve', mode: 'development'}) : platformViteConfig;
    expect(config).toMatchObject({server: {
      host: 'localhost', port: 5174, strictPort: true,
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

describe.each([
  {app: 'playground' as const, prefix: 'PLAYGROUND_CLOUDIOC', viteConfig: playgroundViteConfig,
    path: '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute'},
  {app: 'platform' as const, prefix: 'PLATFORM_CLOUDIOC', viteConfig: platformViteConfig,
    path: '/rest/cdi/cdinl2databuilderservice/'}
])('$app gray 本地凭据', ({app, prefix, viteConfig, path}) => {
  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(process, 'platform', platformDescriptor);
  });

  it('仅 gray 代理携带完整 Cookie 和 cftk，Cookie 不注入浏览器', () => {
    Object.defineProperty(process, 'platform', {value: 'win32'});
    vi.stubEnv(prefix, 'true');
    vi.stubEnv(`${prefix}_CFTK`, ' test-cftk ');
    vi.stubEnv(`${prefix}_COOKIE`, ' session=test-session; route=test-route== ');
    const config = typeof viteConfig === 'function'
      ? viteConfig({command: 'serve', mode: 'development'}) : viteConfig;
    expect(config).toMatchObject({server: {
      host: app === 'platform' ? 'localhost' : 'local.cloudioc.huawei.com',
      port: app === 'platform' ? 5174 : 443, strictPort: true,
      proxy: {[path]: {target: 'https://gray.cloudioc.huawei.com', changeOrigin: true, secure: false,
        headers: {cftk: 'test-cftk', cookie: 'session=test-session; route=test-route=='}}}
    }});
    expect(JSON.stringify(config.define)).not.toContain('test-session');
    expect(config.server?.proxy?.['/api/ai/conversations/']).not.toHaveProperty('headers');
    expect(config.plugins).toEqual(expect.arrayContaining([expect.objectContaining({name: 'vite:basic-ssl'})]));
    if (app === 'platform') {
      expect(config.server?.proxy?.['/rest/cdi/cdinl2databuilderservice/v1/dsl/execute']).toBeUndefined();
    }
  });

  it.each(['', '   '])('Cookie 可选且留空不覆盖浏览器 Cookie：%j', (cookie) => {
    Object.defineProperty(process, 'platform', {value: 'win32'});
    vi.stubEnv(prefix, 'true');
    vi.stubEnv(`${prefix}_CFTK`, 'test-cftk');
    vi.stubEnv(`${prefix}_COOKIE`, cookie);
    const config = typeof viteConfig === 'function'
      ? viteConfig({command: 'serve', mode: 'development'}) : viteConfig;
    expect(config.server?.proxy?.[path]).toHaveProperty('headers', {cftk: 'test-cftk'});
  });

  it.each([
    {suffix: 'CFTK', value: ''},
    {suffix: 'CFTK', value: 'secret\r\nheader'},
    {suffix: 'COOKIE', value: 'session=secret\n'},
    {suffix: 'COOKIE', value: 'session=secret\u0001'},
    {suffix: 'COOKIE', value: 'session=请替换'}
  ])('非法 $suffix 在启动时拒绝且错误只列配置键', ({suffix, value}) => {
    Object.defineProperty(process, 'platform', {value: 'win32'});
    vi.stubEnv(prefix, 'true');
    vi.stubEnv(`${prefix}_CFTK`, 'test-cftk');
    vi.stubEnv(`${prefix}_COOKIE`, 'session=valid');
    vi.stubEnv(`${prefix}_${suffix}`, value);
    expect(() => readCloudIocDevConfig({command: 'serve', mode: 'development'}, resolve(`apps/${app}`), app))
      .toThrow(new Error(`请在 apps/${app}/.env.local 中填写有效的 ${prefix}_${suffix}，再启动开发服务器`));
  });

  it.each([
    {platform: 'darwin', command: 'serve' as const, enabled: 'true', isPreview: false},
    {platform: 'linux', command: 'serve' as const, enabled: 'true', isPreview: false},
    {platform: 'win32', command: 'serve' as const, enabled: 'false', isPreview: false},
    {platform: 'win32', command: 'build' as const, enabled: 'true', isPreview: false},
    {platform: 'win32', command: 'serve' as const, enabled: 'true', isPreview: true}
  ])('忽略非目标环境中的无效凭据：$platform / $command / $enabled / $isPreview', ({platform, command, enabled, isPreview}) => {
    Object.defineProperty(process, 'platform', {value: platform});
    vi.stubEnv(prefix, enabled);
    vi.stubEnv(`${prefix}_CFTK`, '');
    vi.stubEnv(`${prefix}_COOKIE`, 'secret\r\n');
    const config = typeof viteConfig === 'function'
      ? viteConfig({command, mode: 'development', isPreview}) : viteConfig;
    expect(config.server?.proxy?.[path]).not.toHaveProperty('headers');
    expect(JSON.stringify(config.define ?? {})).not.toMatch(/CLOUDIOC|secret/);
    if (app === 'platform') expect(config.server?.proxy?.[path]).toHaveProperty('target', 'https://ioc.cloudbu.huawei.com');
  });
});
