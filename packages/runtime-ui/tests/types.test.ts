import { describe, expect, it } from 'vitest';
import {
  isCatalogSnapshot,
  isDataGateway
} from '../src/types';

describe('统一运行时接入配置', () => {
  it('只接受完整元数据快照形态', () => {
    expect(
      isCatalogSnapshot({
        formatVersion: '2.0',
        syncedAt: '2026-07-30T00:00:00.000Z',
        source: 'test',
        metrics: [{
          code: 'gmv',
          name: '成交总额',
          valueType: 'integer',
          availableDimensions: ['region'],
          availableAggregations: ['sum']
        }],
        dimensions: [{
          code: 'region',
          name: '区域',
          cardinality: 2
        }]
      })
    ).toBe(true);
    expect(isCatalogSnapshot({ formatVersion: '2.0' })).toBe(false);
  });

  it('按数据网关端口检查两个必需方法', () => {
    expect(
      isDataGateway({
        async fetchData() {
          return [];
        },
        async fetchDimensionValues() {
          return [];
        }
      })
    ).toBe(true);
    expect(isDataGateway({ fetchData() {} })).toBe(false);
  });
});
