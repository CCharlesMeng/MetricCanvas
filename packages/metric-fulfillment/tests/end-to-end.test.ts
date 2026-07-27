import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createCatalogDiscovery } from '@metriccanvas/catalog-discovery';
import { syncCatalog } from '@metriccanvas/data-gateway';
import { createHttpDpCatalog } from '@metriccanvas/dp-catalog';
import { createDpMetricRegistry } from '@metriccanvas/dp-sim';
import { createDpSimServer } from '@metriccanvas/dp-sim/server';
import { createSimServer } from '@metriccanvas/data-service-sim';
import { createMemoryMetricFulfillment } from '@metriccanvas/metric-fulfillment';

const servers: Array<ReturnType<typeof createDpSimServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
    )
  );
});

describe('指标履约端到端', () => {
  it('DP 发布后仍等待数据服务目录，目录发现最终 code 与能力后才已履约', async () => {
    const dpServer = createDpSimServer(
      createDpMetricRegistry({ seed: [], createId: () => 'dp-metric-e2e' })
    );
    const dataServiceServer = createSimServer();
    const dpBaseUrl = await listen(dpServer);
    const dataServiceBaseUrl = await listen(dataServiceServer);

    const created = await fetch(`${dpBaseUrl}/__admin/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Tokens 消耗量 E2E',
        definition: '统计输入与输出 Tokens 总量。',
        dimensions: ['office', 'model'],
        aggregations: ['sum']
      })
    });
    expect(created.status).toBe(201);

    const dpCatalog = createHttpDpCatalog({ baseUrl: dpBaseUrl });
    const catalog = createCatalogDiscovery({
      current: async () => {
        const snapshot = await syncCatalog({
          baseUrl: dataServiceBaseUrl,
          headers: {
            'x-operator-id': 'tester',
            tenantId: 'dev'
          }
        });
        return { version: snapshot.syncedAt, snapshot };
      }
    });
    const fulfillment = createMemoryMetricFulfillment({ dpCatalog, catalog });
    const owner = { actorId: 'developer-1', clientId: 'workbench' };
    const reviewer = {
      actorId: 'reviewer-data-1',
      clientId: 'workbench',
      capabilities: ['metric_reviewer'] as const
    };

    const saved = await fulfillment.saveBlueprint(
      {
        blueprintId: null,
        pageId: 'tokens-report',
        baseRevisionId: 'revision-1',
        goal: '补齐 Tokens 消耗指标',
        modules: [],
        metricRequests: [
          {
            requestKey: 'tokens-consumption-e2e',
            name: 'Tokens 消耗量 E2E',
            definition: '统计输入与输出 Tokens 总量。',
            requiredDimensions: ['office', 'model'],
            requiredAggregations: ['sum'],
            necessity: 'required',
            suggestedBy: 'user',
            contextSummary: '端到端验收'
          }
        ],
        idempotencyKey: 'save-e2e'
      },
      owner
    );
    if (!saved.ok) throw new Error(saved.error.message);
    const blueprintId = saved.snapshot.blueprint.blueprintId;
    const requestId = saved.snapshot.requests[0]!.requestId;

    await fulfillment.recordMetricGap(
      {
        blueprintId,
        requestId,
        reviewerId: reviewer.actorId,
        userConfirmed: true,
        idempotencyKey: 'record-e2e'
      },
      owner
    );
    await fulfillment.reviewMetricRequest(
      {
        blueprintId,
        requestId,
        decision: 'accept',
        idempotencyKey: 'review-e2e'
      },
      reviewer
    );
    await fulfillment.linkDpMetric(
      {
        blueprintId,
        requestId,
        dpMetricId: 'dp-metric-e2e',
        idempotencyKey: 'link-e2e'
      },
      reviewer
    );

    await fetch(`${dpBaseUrl}/__admin/metrics/dp-metric-e2e/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'token-consumption-e2e',
        catalog: 'data-service'
      })
    });
    const publishedOnly = await fulfillment.refresh(
      { blueprintId },
      { actorId: 'system-sync', clientId: 'poller' }
    );
    expect(publishedOnly).toMatchObject({
      ok: true,
      snapshot: {
        requests: [
          {
            status: 'awaiting_catalog_verification',
            catalogVerification: { status: 'metric_missing' }
          }
        ]
      }
    });

    await fetch(`${dataServiceBaseUrl}/__admin/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'token-consumption-e2e',
        name: 'Tokens 消耗量 E2E',
        dimensions: ['office', 'model']
      })
    });
    const fulfilled = await fulfillment.refresh(
      { blueprintId },
      { actorId: 'system-sync', clientId: 'poller' }
    );
    expect(fulfilled).toMatchObject({
      ok: true,
      snapshot: {
        group: { readiness: 'ready' },
        requests: [
          {
            status: 'fulfilled',
            finalMetricCode: 'token-consumption-e2e',
            catalogVerification: { status: 'verified' }
          }
        ],
        notifications: [
          {
            recipientId: 'developer-1',
            type: 'metric_group_ready'
          }
        ]
      }
    });
  });
});

async function listen(
  server: ReturnType<typeof createDpSimServer>
): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
