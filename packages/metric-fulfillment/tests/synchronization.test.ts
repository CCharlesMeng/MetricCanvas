import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot } from '@metriccanvas/page';
import { createCatalogDiscovery } from '@metriccanvas/catalog-discovery';
import type { DpCatalog, DpMetric } from '@metriccanvas/dp-catalog';
import { createMemoryMetricFulfillment } from '@metriccanvas/metric-fulfillment';

const draftMetric: DpMetric = {
  id: 'dp-token-consumption',
  code: null,
  name: 'Tokens 消耗量',
  definition: '统计模型实际计费的输入与输出 Tokens 总量，不含缓存命中量。',
  dimensions: ['office', 'model'],
  aggregations: ['sum', 'day', 'month'],
  status: 'draft',
  catalog: null,
  createdAt: '2026-07-23T02:20:00.000Z',
  updatedAt: '2026-07-23T02:20:00.000Z'
};

describe('指标履约同步', () => {
  it('DP 发布后仍等待当前数据服务目录复验,通过后只通知且不修改页面修订', async () => {
    let dpMetric = structuredClone(draftMetric);
    let catalogSnapshot = catalogWithoutTokens();
    const dpCatalog: DpCatalog = {
      searchCandidates: async () => ({ candidates: [] }),
      getMetric: async (id) => (id === dpMetric.id ? structuredClone(dpMetric) : null)
    };
    const catalog = createCatalogDiscovery({
      current: async () => ({
        version: catalogSnapshot.metrics.length ? 'catalog-v2' : 'catalog-v1',
        snapshot: catalogSnapshot
      })
    });
    const fulfillment = createMemoryMetricFulfillment({
      dpCatalog,
      catalog,
      ids: sequenceIds(
        'blueprint-1',
        'group-1',
        'request-1',
        'audit-1',
        'confirmation-1',
        'audit-2',
        'review-1',
        'audit-3',
        'audit-4',
        'audit-5',
        'audit-6',
        'notification-1'
      ),
      clock: fixedClock('2026-07-23T02:30:00.000Z')
    });
    await prepareLinkedRequest(fulfillment);

    dpMetric = {
      ...dpMetric,
      status: 'published',
      code: 'token-consumption',
      catalog: 'data-service',
      updatedAt: '2026-07-23T02:31:00.000Z'
    };
    const publishedOnly = await fulfillment.refresh(
      { blueprintId: 'blueprint-1' },
      { actorId: 'system', clientId: 'poller' }
    );
    expect(publishedOnly).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        blueprint: expect.objectContaining({
          baseRevisionId: 'revision-4'
        }),
        requests: [
          expect.objectContaining({
            status: 'awaiting_catalog_verification',
            finalMetricCode: 'token-consumption',
            targetCatalog: 'data-service',
            catalogVerification: {
              status: 'metric_missing',
              metadataVersion: 'catalog-v1',
              missingDimensions: [],
              missingAggregations: [],
              verifiedAt: null
            }
          })
        ],
        group: expect.objectContaining({ readiness: 'blocked' }),
        notifications: []
      })
    });

    catalogSnapshot = catalogWithTokens();
    const fulfilled = await fulfillment.refresh(
      { blueprintId: 'blueprint-1' },
      { actorId: 'system', clientId: 'poller' }
    );
    const replay = await fulfillment.refresh(
      { blueprintId: 'blueprint-1' },
      { actorId: 'system', clientId: 'poller' }
    );

    expect(fulfilled).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        blueprint: expect.objectContaining({
          baseRevisionId: 'revision-4'
        }),
        requests: [
          expect.objectContaining({
            status: 'fulfilled',
            catalogVerification: {
              status: 'verified',
              metadataVersion: 'catalog-v2',
              missingDimensions: [],
              missingAggregations: [],
              verifiedAt: '2026-07-23T02:30:00.000Z'
            }
          })
        ],
        group: expect.objectContaining({ readiness: 'ready' }),
        notifications: [
          expect.objectContaining({
            notificationId: 'notification-1',
            recipientId: 'user-meng',
            type: 'metric_group_ready',
            readAt: null
          })
        ]
      })
    });
    expect(replay.ok && replay.snapshot.notifications).toHaveLength(1);
  });

  it('DP 查询异常保留等待状态并暴露同步异常,不误判为拒绝', async () => {
    let fail = false;
    const fulfillment = createMemoryMetricFulfillment({
      dpCatalog: {
        searchCandidates: async () => ({ candidates: [] }),
        getMetric: async () => {
          if (fail) throw new Error('DP timeout');
          return structuredClone(draftMetric);
        }
      },
      catalog: createCatalogDiscovery({
        current: async () => ({ version: 'catalog-v1', snapshot: catalogWithoutTokens() })
      }),
      ids: sequenceIds(
        'blueprint-1',
        'group-1',
        'request-1',
        'audit-1',
        'confirmation-1',
        'audit-2',
        'review-1',
        'audit-3',
        'audit-4',
        'audit-5'
      ),
      clock: fixedClock('2026-07-23T02:30:00.000Z')
    });
    await prepareLinkedRequest(fulfillment);
    fail = true;

    const refreshed = await fulfillment.refresh(
      { blueprintId: 'blueprint-1' },
      { actorId: 'system', clientId: 'poller' }
    );

    expect(refreshed).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        requests: [
          expect.objectContaining({
            status: 'awaiting_publication',
            syncError: 'DP timeout'
          })
        ]
      })
    });
  });
});

type Fulfillment = ReturnType<typeof createMemoryMetricFulfillment>;

async function prepareLinkedRequest(fulfillment: Fulfillment) {
  await fulfillment.saveBlueprint(
    {
      blueprintId: null,
      pageId: 'tokens-operations',
      baseRevisionId: 'revision-4',
      goal: '按办公区和模型观察 Tokens 消耗趋势',
      modules: [
        {
          moduleId: 'overview',
          title: 'Tokens 消耗概览',
          metricRequestKeys: ['tokens-consumption']
        }
      ],
      metricRequests: [
        {
          requestKey: 'tokens-consumption',
          name: 'Tokens 消耗量',
          definition: draftMetric.definition,
          requiredDimensions: ['office', 'model'],
          requiredAggregations: ['sum', 'day', 'month'],
          necessity: 'required',
          suggestedBy: 'user',
          contextSummary: '用于办公区与模型消耗趋势分析'
        }
      ],
      idempotencyKey: 'save-blueprint-1'
    },
    { actorId: 'user-meng', clientId: 'workbench' }
  );
  await fulfillment.recordMetricGap(
    {
      blueprintId: 'blueprint-1',
      requestId: 'request-1',
      reviewerId: 'reviewer-chen',
      userConfirmed: true,
      idempotencyKey: 'record-gap-1'
    },
    { actorId: 'user-meng', clientId: 'workbench' }
  );
  await fulfillment.reviewMetricRequest(
    {
      blueprintId: 'blueprint-1',
      requestId: 'request-1',
      decision: 'accept',
      idempotencyKey: 'review-1'
    },
    {
      actorId: 'reviewer-chen',
      clientId: 'workbench',
      capabilities: ['metric_reviewer']
    }
  );
  await fulfillment.linkDpMetric(
    {
      blueprintId: 'blueprint-1',
      requestId: 'request-1',
      dpMetricId: draftMetric.id,
      idempotencyKey: 'link-dp-1'
    },
    {
      actorId: 'reviewer-chen',
      clientId: 'workbench',
      capabilities: ['metric_reviewer']
    }
  );
}

function catalogWithoutTokens(): CatalogSnapshot {
  return {
    formatVersion: '2.0',
    syncedAt: '2026-07-23T02:00:00.000Z',
    source: 'data-service',
    metrics: [],
    dimensions: [
      { code: 'office', name: '办公区', valueType: 'string', cardinality: 8 },
      { code: 'model', name: '模型', valueType: 'string', cardinality: 12 }
    ]
  };
}

function catalogWithTokens(): CatalogSnapshot {
  return {
    ...catalogWithoutTokens(),
    syncedAt: '2026-07-23T02:32:00.000Z',
    metrics: [
      {
        code: 'token-consumption',
        name: 'Tokens 消耗量',
        valueType: 'integer',
        availableDimensions: ['office', 'model'],
        availableAggregations: ['sum', 'day', 'month']
      }
    ]
  };
}

function sequenceIds(...values: string[]) {
  let index = 0;
  return { next: () => values[index++]! };
}

function fixedClock(iso: string) {
  return { now: () => new Date(iso) };
}
