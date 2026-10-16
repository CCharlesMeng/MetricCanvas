import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { createServer } from 'vite';
import {
  AI_SUMMARY_CONVERSATIONS_PATH,
  createDqeSimServer,
  DQE_EXECUTE_PATH
} from '../tools/dqe-sim/src/server';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
  vi.unstubAllEnvs();
});

it('两个前端通过同源路径代理 DQE 和 SSE，平台远端目标使用本地服务替身', async () => {
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
