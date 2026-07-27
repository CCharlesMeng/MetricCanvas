import { describe, expect, it } from 'vitest';
import {
  createMemoryDpCatalog,
  type DpMetric
} from '@metriccanvas/dp-catalog';
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

describe('DP 指标关联', () => {
  it('页面搭建蓝图所有者明确确认后可直接复用已有 DP 指标', async () => {
    const publishedMetric: DpMetric = {
      ...draftMetric,
      id: 'dp-token-consumption-published',
      code: 'token-consumption',
      status: 'published',
      catalog: 'data-service'
    };
    const fulfillment = createMemoryMetricFulfillment({
      dpCatalog: createMemoryDpCatalog([publishedMetric]),
      ids: sequenceIds(
        'blueprint-1',
        'group-1',
        'request-1',
        'audit-1',
        'confirmation-1',
        'audit-2'
      ),
      clock: fixedClock('2026-07-23T02:30:00.000Z')
    });
    await fulfillment.saveBlueprint(
      {
        blueprintId: null,
        pageId: 'tokens-operations',
        baseRevisionId: 'revision-4',
        goal: 'Tokens 消耗趋势',
        modules: [],
        metricRequests: [
          {
            requestKey: 'tokens-consumption',
            name: 'Tokens 消耗量',
            definition: '统计 Tokens 消耗量',
            requiredDimensions: ['office'],
            requiredAggregations: ['sum'],
            necessity: 'required',
            suggestedBy: 'user',
            contextSummary: '页面主指标'
          }
        ],
        idempotencyKey: 'save-blueprint-1'
      },
      { actorId: 'user-meng', clientId: 'workbench' }
    );

    const reused = await fulfillment.confirmDpMetricReuse(
      {
        blueprintId: 'blueprint-1',
        requestId: 'request-1',
        dpMetricId: publishedMetric.id,
        userConfirmed: true,
        idempotencyKey: 'reuse-dp-1'
      },
      { actorId: 'user-meng', clientId: 'workbench' }
    );

    expect(reused).toMatchObject({
      ok: true,
      snapshot: {
        requests: [
          {
            dpMetricId: publishedMetric.id,
            finalMetricCode: 'token-consumption',
            status: 'awaiting_catalog_verification'
          }
        ],
        businessConfirmations: [
          {
            decision: 'reuse_dp_metric',
            dpMetricId: publishedMetric.id,
            actorId: 'user-meng'
          }
        ]
      }
    });
  });

  it('数据开发确认后关联稳定 DP 指标 ID,草稿状态继续等待发布', async () => {
    const fulfillment = createMemoryMetricFulfillment({
      dpCatalog: createMemoryDpCatalog([draftMetric]),
      ids: sequenceIds(
        'blueprint-1',
        'group-1',
        'request-1',
        'audit-1',
        'confirmation-1',
        'audit-2',
        'review-1',
        'audit-3',
        'audit-4'
      ),
      clock: fixedClock('2026-07-23T02:30:00.000Z')
    });
    await prepareAcceptedRequest(fulfillment);

    const linked = await fulfillment.linkDpMetric(
      {
        blueprintId: 'blueprint-1',
        requestId: 'request-1',
        dpMetricId: 'dp-token-consumption',
        idempotencyKey: 'link-dp-1'
      },
      {
        actorId: 'reviewer-chen',
        clientId: 'workbench',
        capabilities: ['metric_reviewer']
      }
    );

    expect(linked).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        requests: [
          expect.objectContaining({
            requestId: 'request-1',
            dpMetricId: 'dp-token-consumption',
            finalMetricCode: null,
            targetCatalog: null,
            status: 'awaiting_publication'
          })
        ],
        audits: expect.arrayContaining([
          expect.objectContaining({
            auditId: 'audit-4',
            action: 'dp_metric_linked',
            details: {
              dpMetricId: 'dp-token-consumption',
              dpStatus: 'draft'
            }
          })
        ])
      })
    });
  });
});

type Fulfillment = ReturnType<typeof createMemoryMetricFulfillment>;

async function prepareAcceptedRequest(fulfillment: Fulfillment) {
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
          definition: '统计模型实际计费的输入与输出 Tokens 总量，不含缓存命中量。',
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
}

function sequenceIds(...values: string[]) {
  let index = 0;
  return { next: () => values[index++]! };
}

function fixedClock(iso: string) {
  return { now: () => new Date(iso) };
}
