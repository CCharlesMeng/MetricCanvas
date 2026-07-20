import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot } from '@metriccanvas/page';
import { createMockGateway } from '../src/mock';

/** 测试用快照(独立事实):基数与样例值是断言的直接依据 */
const catalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-20T00:00:00.000Z',
  source: '测试构造',
  metrics: [
    {
      code: 'gmv',
      name: '成交总额',
      valueType: 'decimal',
      availableDimensions: ['region', 'channel'],
      availableAggregations: ['sum']
    },
    {
      code: 'order-count',
      name: '订单量',
      valueType: 'integer',
      availableDimensions: ['region'],
      availableAggregations: ['sum']
    },
    {
      code: 'target-rate',
      name: '目标完成率',
      valueType: 'percent',
      availableDimensions: [],
      availableAggregations: ['avg']
    }
  ],
  dimensions: [
    { code: 'region', name: '区域', cardinality: 3, sampleValues: ['华东', '华北', '华南'] },
    { code: 'channel', name: '渠道', cardinality: 2 }
  ]
};

const gateway = createMockGateway({ delayMs: 0, catalog });

describe('mock 适配器:按元数据快照造形状正确的假数据', () => {
  it('无维度查询返回单行,含全部指标列', async () => {
    const rows = await gateway.fetchData({ metrics: ['gmv', 'order-count'], conditions: [] });
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['gmv', 'order-count']);
  });

  it('按维度基数造行:region 基数 3 → 3 行,维度值用快照样例值', async () => {
    const rows = await gateway.fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: []
    });
    expect(rows.map((r) => r.region)).toEqual(['华东', '华北', '华南']);
  });

  it('多维度取笛卡尔积:region(3) × channel(2) → 6 行,无样例值的维度按 code 补造', async () => {
    const rows = await gateway.fetchData({
      metrics: ['gmv'],
      dimensions: ['region', 'channel'],
      conditions: []
    });
    expect(rows).toHaveLength(6);
    const channels = new Set(rows.map((r) => r.channel));
    expect(channels.size).toBe(2);
    for (const value of channels) {
      expect(String(value)).toContain('channel');
    }
  });

  it('按指标类型造值:integer 为整数,decimal 至多两位小数,percent 在 0~100', async () => {
    const [row] = await gateway.fetchData({
      metrics: ['order-count', 'gmv', 'target-rate'],
      conditions: []
    });
    expect(Number.isInteger(row['order-count'])).toBe(true);
    expect(Number(row['gmv'])).toBe(Number(Number(row['gmv']).toFixed(2)));
    expect(Number(row['target-rate'])).toBeGreaterThanOrEqual(0);
    expect(Number(row['target-rate'])).toBeLessThanOrEqual(100);
  });

  it('造数确定性:同一查询两次取数结果完全一致(刷新不跳变)', async () => {
    const query = { metrics: ['gmv'], dimensions: ['region'] as string[], conditions: [] };
    expect(await gateway.fetchData(query)).toEqual(await gateway.fetchData(query));
  });

  it('不传快照时保持切片1行为:单行、确定性数值(现有调用不破)', async () => {
    const legacy = createMockGateway({ delayMs: 0 });
    const rows = await legacy.fetchData({ metrics: ['gmv'], conditions: [] });
    expect(rows).toHaveLength(1);
    expect(typeof rows[0].gmv).toBe('number');
  });
});
