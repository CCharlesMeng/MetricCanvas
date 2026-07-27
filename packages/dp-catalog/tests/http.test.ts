import { afterEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createDpSimServer } from '@metriccanvas/dp-sim/server';
import { createHttpDpCatalog } from '@metriccanvas/dp-catalog';

describe('DP HTTP 适配器', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    server.close();
    await once(server, 'close');
    server = undefined;
  });

  it('按仿真查询契约返回草稿与已发布候选的结构化事实', async () => {
    server = createDpSimServer().listen(0);
    await once(server, 'listening');
    const port = (server.address() as AddressInfo).port;
    const catalog = createHttpDpCatalog({ baseUrl: `http://127.0.0.1:${port}` });

    await expect(
      catalog.searchCandidates({
        query: 'Tokens流水',
        requiredDimensions: ['office', 'model'],
        requiredAggregations: ['day', 'month']
      })
    ).resolves.toEqual({
      candidates: [
        {
          metric: expect.objectContaining({
            id: 'dp-metric-token-revenue',
            code: null,
            status: 'draft'
          }),
          matchReasons: ['name_subsequence'],
          missingDimensions: [],
          missingAggregations: []
        }
      ]
    });
  });

  it('按稳定 DP 指标 ID 查询发布事实,不存在时返回 null', async () => {
    server = createDpSimServer().listen(0);
    await once(server, 'listening');
    const port = (server.address() as AddressInfo).port;
    const catalog = createHttpDpCatalog({ baseUrl: `http://127.0.0.1:${port}` });

    await expect(catalog.getMetric('dp-metric-token-revenue')).resolves.toEqual(
      expect.objectContaining({
        id: 'dp-metric-token-revenue',
        code: null,
        status: 'draft',
        catalog: null
      })
    );
    await expect(catalog.getMetric('does-not-exist')).resolves.toBeNull();
  });
});
