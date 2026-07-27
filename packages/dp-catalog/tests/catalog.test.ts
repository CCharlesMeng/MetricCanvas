import { describe, expect, it } from 'vitest';
import {
  createMemoryDpCatalog,
  type DpMetric
} from '@metriccanvas/dp-catalog';

const metrics: DpMetric[] = [
  {
    id: 'dp-tokens-revenue',
    code: null,
    name: 'Tokens 总流水',
    definition: '统计 Tokens 使用产生的总流水。',
    dimensions: ['office', 'model'],
    aggregations: ['day', 'month'],
    status: 'draft',
    catalog: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z'
  },
  {
    id: 'dp-model-tokens',
    code: 'model-tokens',
    name: '模型请求 Tokens',
    definition: '统计模型请求输入与输出 Tokens 数量。',
    dimensions: ['model'],
    aggregations: ['sum'],
    status: 'published',
    catalog: 'data-service',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z'
  }
];

describe('DP 指标目录', () => {
  it('返回全部匹配候选及逐项能力缺口,不替调用者选择指标', async () => {
    const catalog = createMemoryDpCatalog(metrics);

    await expect(
      catalog.searchCandidates({
        query: 'Tokens',
        requiredDimensions: ['office', 'model'],
        requiredAggregations: ['sum', 'day', 'month']
      })
    ).resolves.toEqual({
      candidates: [
        {
          metric: metrics[0],
          matchReasons: ['name_contains', 'definition_contains'],
          missingDimensions: [],
          missingAggregations: ['sum']
        },
        {
          metric: metrics[1],
          matchReasons: ['name_contains', 'code_contains', 'definition_contains'],
          missingDimensions: ['office'],
          missingAggregations: ['day', 'month']
        }
      ]
    });
  });
});
