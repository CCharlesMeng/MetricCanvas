import { describe, expect, it } from 'vitest';
import { createDpMetricRegistry, DpMetricConflictError } from '../src/registry';

describe('DP 指标实体仿真', () => {
  it('返回全部名称候选并指出缺失能力，不替用户自动选择', () => {
    const registry = createDpMetricRegistry();

    const candidates = registry.search({
      query: 'tokens流水',
      requiredDimensions: ['office', 'product'],
      requiredAggregations: ['day', 'yoy']
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      metric: {
        id: 'dp-metric-token-revenue',
        status: 'draft',
        code: null
      },
      matchReasons: ['name_subsequence'],
      missingDimensions: ['product'],
      missingAggregations: ['yoy']
    });
  });

  it('创建后立即返回稳定 ID，发布后同一个 ID 获得指标 code 和数据服务目录', () => {
    const timestamps = [
      new Date('2026-07-23T01:00:00.000Z'),
      new Date('2026-07-23T02:00:00.000Z')
    ];
    const registry = createDpMetricRegistry({
      seed: [],
      createId: () => 'metric-100',
      now: () => timestamps.shift() ?? new Date('2026-07-23T03:00:00.000Z')
    });

    const created = registry.create({
      name: 'Tokens 消耗量',
      definition: '统计 Tokens 消耗量。',
      dimensions: ['office', 'office'],
      aggregations: ['day']
    });
    const published = registry.publish(created.id, 'token-consumption', 'data-service');

    expect(created).toMatchObject({
      id: 'metric-100',
      code: null,
      status: 'draft',
      dimensions: ['office']
    });
    expect(published).toMatchObject({
      id: 'metric-100',
      code: 'token-consumption',
      status: 'published',
      catalog: 'data-service',
      updatedAt: '2026-07-23T02:00:00.000Z'
    });
    expect(registry.get(created.id)).toEqual(published);
  });

  it('发布操作幂等且不允许更换已发布指标 code', () => {
    const registry = createDpMetricRegistry({ seed: [], createId: () => 'metric-100' });
    const metric = registry.create({ name: '指标', definition: '定义' });
    const first = registry.publish(metric.id, 'metric-code', 'data-service');
    const retried = registry.publish(metric.id, 'metric-code', 'data-service');

    expect(retried).toEqual(first);
    expect(() => registry.publish(metric.id, 'other-code', 'data-service')).toThrow(
      DpMetricConflictError
    );
  });
});
