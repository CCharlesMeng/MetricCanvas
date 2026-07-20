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

  it('维度自身的 in 条件收窄行集(过滤切行):region in [华东,华南] → 2 行', async () => {
    const rows = await gateway.fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [{ dimension: 'region', operator: 'in', value: ['华东', '华南'] }]
    });
    expect(rows.map((r) => r.region)).toEqual(['华东', '华南']);
  });

  it('查询维度之外的条件与时间范围参与数值扰动(条件改数),无筛选时保持原种子', async () => {
    const base = await gateway.fetchData({ metrics: ['gmv'], dimensions: ['region'], conditions: [] });
    const filtered = await gateway.fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [{ dimension: 'channel', operator: 'in', value: ['线上'] }]
    });
    const timed = await gateway.fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [],
      timeRange: { from: '2026-07-01', to: '2026-07-20' }
    });
    // 切行数不变(channel 不在查询维度里),但数值被扰动;时间范围同理
    expect(filtered).toHaveLength(base.length);
    expect(filtered.map((r) => r.gmv)).not.toEqual(base.map((r) => r.gmv));
    expect(timed.map((r) => r.gmv)).not.toEqual(base.map((r) => r.gmv));
    // 无筛选查询与切片3 种子一致:重复查询结果完全相同
    expect(await gateway.fetchData({ metrics: ['gmv'], dimensions: ['region'], conditions: [] })).toEqual(base);
  });

  it('遵守 orderBy:按维度值排序(盲翻在 mock 模式可验的前提;码位序手算:东<北<南)', async () => {
    const rows = await gateway.fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [],
      orderBy: [{ field: 'region', direction: 'desc' }]
    });
    expect(rows.map((r) => r.region)).toEqual(['华南', '华北', '华东']);
  });

  it('遵守 limit/offset:offset 跳行、limit 截断,行序与不分页时一致', async () => {
    const all = await gateway.fetchData({ metrics: ['gmv'], dimensions: ['region'], conditions: [] });
    const paged = await gateway.fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [],
      limit: 2,
      offset: 1
    });
    expect(paged).toEqual(all.slice(1, 3));
  });

  it('遵守指标列排序:按造出的 gmv 数值降序', async () => {
    const all = await gateway.fetchData({ metrics: ['gmv'], dimensions: ['region'], conditions: [] });
    const sorted = await gateway.fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [],
      orderBy: [{ field: 'gmv', direction: 'desc' }]
    });
    expect(sorted.map((r) => r.gmv)).toEqual(all.map((r) => Number(r.gmv)).sort((a, b) => b - a));
  });

  it('fetchDimensionValues:样例值优先、不足基数按 code 补造;快照缺失该维度时造 3 个', async () => {
    expect(await gateway.fetchDimensionValues('region')).toEqual(['华东', '华北', '华南']);
    expect(await gateway.fetchDimensionValues('channel')).toEqual(['channel-1', 'channel-2']);
    expect(await gateway.fetchDimensionValues('unknown')).toEqual([
      'unknown-1',
      'unknown-2',
      'unknown-3'
    ]);
  });
});
