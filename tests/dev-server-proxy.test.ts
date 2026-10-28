import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { createServer } from 'vite';
import {
  AI_SUMMARY_CONVERSATIONS_PATH,
  createDqeSimServer,
  DQE_EXECUTE_PATH
} from '../tools/dqe-sim/src/server';

const cleanup: Array<() => Promise<void>> = [];
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Object.defineProperty(process, 'platform', platformDescriptor);
});

it.each([
  {app: 'playground', cookie: 'session=configured; route=gray=='},
  {app: 'playground', cookie: ''},
  {app: 'platform', cookie: 'session=configured; route=gray=='},
  {app: 'platform', cookie: ''}
])('$app gray 代理实际转发 cftk 与 Cookie（配置 %j）', async ({app, cookie}) => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const received: Array<{cftk: unknown; cookie: unknown; url: unknown; method: unknown; body: string}> = [];
  const upstream = createHttpServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    received.push({cftk: request.headers.cftk, cookie: request.headers.cookie,
      url: request.url, method: request.method, body});
    response.end('{}');
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  cleanup.push(() => new Promise<void>((resolve, reject) => {
    upstream.close((error) => error ? reject(error) : resolve());
  }));
  Object.defineProperty(process, 'platform', {value: 'win32'});
  const prefix = `${app.toUpperCase()}_CLOUDIOC`;
  vi.stubEnv(prefix, 'true');
  vi.stubEnv(`${prefix}_CFTK`, 'test-config-cftk');
  vi.stubEnv(`${prefix}_COOKIE`, cookie);
  const viteConfig = app === 'playground'
    ? (await import('../apps/playground/vite.config')).default
    : (await import('../apps/platform/vite.config')).default;
  const config = typeof viteConfig === 'function'
    ? await viteConfig({command: 'serve', mode: 'development'}) : await viteConfig;
  Object.defineProperty(process, 'platform', platformDescriptor);
  const path = app === 'playground' ? DQE_EXECUTE_PATH : '/rest/cdi/cdinl2databuilderservice/';
  const dqeProxy = config.server?.proxy?.[path];
  if (!dqeProxy || typeof dqeProxy === 'string') throw new Error('Missing DQE proxy');
  const frontend = await createServer({
    configFile: false,
    server: {host: '127.0.0.1', port: 0, strictPort: false, proxy: {
      [path]: {...dqeProxy, target: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`}
    }},
    logLevel: 'silent'
  });
  cleanup.push(() => frontend.close());
  await frontend.listen();
  const origin = `http://127.0.0.1:${(frontend.httpServer!.address() as AddressInfo).port}`;
  const paths = [DQE_EXECUTE_PATH + '?debug=1', ...(app === 'platform'
    ? ['/rest/cdi/cdinl2databuilderservice/v1/user-page-metadata?page=1'] : [])];
  for (const requestPath of paths) {
    const response = await fetch(origin + requestPath, {
      method: 'POST', body: '{}', headers: {cookie: 'session=browser', cftk: 'browser-cftk'}
    });
    expect(response.status).toBe(200);
  }
  expect(received).toEqual(paths.map(url => ({url, method: 'POST', body: '{}',
    cftk: 'test-config-cftk', cookie: cookie || 'session=browser'})));
  if (app === 'platform') {
    expect(dqeProxy.secure).toBe(false);
    expect(log.mock.calls).toEqual(paths.map(url => [
      '[platform proxy]', 'POST', url.split('?')[0], {cftk: true, cookie: true}
    ]));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/test-config-cftk|session=|debug=|page=|browser-cftk/);
  }
});

it('两个前端通过同源路径代理 DQE 和 SSE，平台远端目标使用本地服务替身', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const upstream = createDqeSimServer({
    logger: false, aiSummaryText: '完成', aiSummaryCharacterIntervalMs: 0
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  cleanup.push(() => new Promise<void>((resolve, reject) => {
    upstream.close((error) => error ? reject(error) : resolve());
  }));
  vi.stubEnv('DQE_SIM_PORT', String((upstream.address() as AddressInfo).port));
  vi.stubEnv('PLAYGROUND_CLOUDIOC', 'false');
  vi.stubEnv('PLATFORM_CLOUDIOC', 'false');

  const playground = (await import('../apps/playground/vite.config')).default;
  const platform = (await import('../apps/platform/vite.config')).default;
  const playgroundConfig = typeof playground === 'function'
    ? await playground({ command: 'serve', mode: 'development' }) : await playground;
  const platformConfig = typeof platform === 'function'
    ? await platform({ command: 'serve', mode: 'development' }) : await platform;
  for (const config of [playgroundConfig, platformConfig]) {
    const proxy = {...config.server?.proxy};
    const prefix = '/rest/cdi/cdinl2databuilderservice/';
    const remoteProxy = proxy[prefix];
    if (remoteProxy && typeof remoteProxy !== 'string') {
      expect(remoteProxy.secure).toBe(false);
      proxy[prefix] = {...remoteProxy, target: `http://127.0.0.1:${process.env.DQE_SIM_PORT}`};
    }
    const frontend = await createServer({
      configFile: false,
      server: { ...config.server, proxy, host: '127.0.0.1', port: 0, strictPort: false },
      logLevel: 'silent'
    });
    cleanup.push(() => frontend.close());
    await frontend.listen();
    const origin = `http://127.0.0.1:${(frontend.httpServer!.address() as AddressInfo).port}`;
    const response = await fetch(origin + DQE_EXECUTE_PATH, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dsl_list: [{
        output_metrics: ['NA客户数'], output_dims: ['客户级别'],
        filter: {
          time: { period: 'month', is_aggregate: true, start: '2026-07', end: '2026-07' },
          dims: [
            { dim_name: '地区部', dim_value_list: ['中国地区部'] },
            { dim_name: '客户级别', dim_value_list: ['卓越NA'] }
          ],
          metrics: []
        },
        order: {}
      }] })
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: [{ 客户级别: '卓越NA', NA客户数: 15 }] }]
    });
    if (remoteProxy) {
      expect(log).toHaveBeenCalledWith('[platform proxy]', 'POST', DQE_EXECUTE_PATH,
        {cftk: false, cookie: false});
    }
    const summary = await fetch(origin + AI_SUMMARY_CONVERSATIONS_PATH + 'ip-access/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ context_info: {} })
    });
    expect(summary.headers.get('content-type')).toContain('text/event-stream');
    const events = await summary.text();
    expect(events).toContain('"event":"generate"');
    expect(events).toContain('"event":"finish"');
  }
}, 20_000);
