import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot } from '@metriccanvas/page';
import {
  catalogVersionFor,
  createCatalogDiscovery
} from '@metriccanvas/catalog-discovery';

const snapshot: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-20T12:00:00.000Z',
  source: 'data-service-sim',
  metrics: [
    {
      code: 'gmv',
      name: '成交总额',
      valueType: 'decimal',
      availableDimensions: ['region'],
      availableAggregations: ['sum', 'avg']
    },
    {
      code: 'order-count',
      name: '订单量',
      valueType: 'integer',
      availableDimensions: ['region'],
      availableAggregations: ['sum']
    }
  ],
  dimensions: [{ code: 'region', name: '区域', cardinality: 3 }]
};

describe('目录发现', () => {
  it('按业务名称找到唯一受治理指标并返回元数据版本', async () => {
    const discovery = createCatalogDiscovery({
      current: async () => ({ version: 'catalog-v1', snapshot })
    });

    await expect(discovery.search({ query: '成交总额', limit: 10 })).resolves.toEqual({
      metadataVersion: 'catalog-v1',
      matches: [
        {
          kind: 'metric',
          code: 'gmv',
          name: '成交总额',
          valueType: 'decimal',
          availableDimensions: ['region'],
          availableAggregations: ['sum', 'avg']
        }
      ]
    });
  });

  it('元数据版本只由指标与维度语义决定,不受同步时间和数组顺序影响', () => {
    const reordered: CatalogSnapshot = {
      ...snapshot,
      syncedAt: '2026-07-21T08:00:00.000Z',
      source: 'another-endpoint',
      metrics: [...snapshot.metrics]
        .reverse()
        .map((metric) => ({
          ...metric,
          availableDimensions: [...metric.availableDimensions].reverse(),
          availableAggregations: [...metric.availableAggregations].reverse()
        })),
      dimensions: [...snapshot.dimensions].reverse()
    };
    const changed: CatalogSnapshot = {
      ...snapshot,
      metrics: snapshot.metrics.map((metric) =>
        metric.code === 'gmv'
          ? { ...metric, availableAggregations: ['sum'] }
          : metric
      )
    };

    expect(catalogVersionFor(snapshot)).toMatch(/^[a-f0-9]{64}$/);
    expect(catalogVersionFor(reordered)).toBe(catalogVersionFor(snapshot));
    expect(catalogVersionFor(changed)).not.toBe(catalogVersionFor(snapshot));
  });
});
