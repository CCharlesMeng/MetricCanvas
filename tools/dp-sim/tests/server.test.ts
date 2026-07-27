import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createDpMetricRegistry } from '../src/registry';
import { createDpSimServer } from '../src/server';

const servers: ReturnType<typeof createDpSimServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).filter((server) => server.listening).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe('DP 仿真 HTTP 契约', () => {
  it('支持查询候选、创建草稿、轮询状态和发布', async () => {
    const registry = createDpMetricRegistry({ seed: [], createId: () => 'metric-101' });
    const baseUrl = await listen(createDpSimServer(registry));

    const createdResponse = await fetch(`${baseUrl}/__admin/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Tokens 消耗量',
        definition: '统计 Tokens 消耗量。',
        dimensions: ['office'],
        aggregations: ['day']
      })
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as {
      metric: { id: string; status: string };
    };
    expect(created.metric).toMatchObject({ id: 'metric-101', status: 'draft' });

    const searchResponse = await fetch(`${baseUrl}/v1/metric-candidates/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'tokens消耗', requiredDimensions: ['office'] })
    });
    const search = (await searchResponse.json()) as {
      candidates: Array<{ metric: { id: string } }>;
    };
    expect(search.candidates.map(({ metric }) => metric.id)).toEqual(['metric-101']);

    const publishedResponse = await fetch(`${baseUrl}/__admin/metrics/metric-101/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'token-consumption', catalog: 'data-service' })
    });
    expect(publishedResponse.status).toBe(200);

    const statusResponse = await fetch(`${baseUrl}/v1/metrics/metric-101`);
    expect(await statusResponse.json()).toMatchObject({
      metric: {
        id: 'metric-101',
        code: 'token-consumption',
        status: 'published',
        catalog: 'data-service'
      }
    });
  });

  it('对非法查询返回稳定错误码', async () => {
    const baseUrl = await listen(createDpSimServer(createDpMetricRegistry({ seed: [] })));
    const response = await fetch(`${baseUrl}/v1/metric-candidates/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '' })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'DP_INVALID_SEARCH', message: 'query 必须是非空字符串' }
    });
  });
});

async function listen(server: ReturnType<typeof createDpSimServer>): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
