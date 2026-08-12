import { describe, expect, it } from 'vitest';
import { executeDqeItem } from '../src/execute';

type JsonRecord = Record<string, unknown>;

interface SurfaceQueryInput {
  metrics: string[];
  dims?: string[];
  time?: { period: string; start: string; end: string };
  filterDims?: unknown[];
  filterMetrics?: unknown;
  order?: JsonRecord;
}

function surfaceItem(input: SurfaceQueryInput): JsonRecord {
  return {
    output_metrics: input.metrics,
    output_dims: input.dims ?? [],
    filter: {
      time: input.time ?? { period: 'month', start: '2026-01', end: '2026-03' },
      dims: input.filterDims ?? [],
      metrics: input.filterMetrics ?? []
    },
    order: input.order ?? {}
  };
}

function metricOf(result: ReturnType<typeof executeDqeItem>, name: string): number[] {
  return result.data.map((row) => {
    expect(typeof row[name]).toBe('number');
    return row[name] as number;
  });
}

describe('组合式语义面:确定性', () => {
  it('同一查询体多次执行逐字节一致', () => {
    const item = surfaceItem({
      metrics: ['Tokens消耗量', '计费Tokens量', '客户数'],
      dims: ['区域', '模型'],
      filterDims: [{ dim_name: '区域', dim_value_list: ['华东', '西南'] }]
    });
    const first = executeDqeItem(structuredClone(item));
    const second = executeDqeItem(structuredClone(item));
    const third = executeDqeItem(structuredClone(item));

    expect(first.code).toBe('SUCCESS');
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(third)).toBe(JSON.stringify(first));
  });
});

describe('组合式语义面:合法组合出数与分组语义', () => {
  it('无维度查询返回单行总计,数值落在指标声明的量级内', () => {
    const result = executeDqeItem(surfaceItem({ metrics: ['Tokens消耗量'] }));

    expect(result.code).toBe('SUCCESS');
    expect(result.data).toHaveLength(1);
    expect(result.total_count).toBe(1);
    // 21 个维度坐标 × 3 个月,每个单元格至少 200000。
    const [total] = metricOf(result, 'Tokens消耗量');
    expect(total).toBeGreaterThanOrEqual(21 * 3 * 200000);
    expect(result.dqe.columns).toEqual([
      {
        id: 'dqe-sim.Tokens消耗量',
        caption: 'Tokens消耗量',
        data_type: 'NUMBER',
        type: 'metric'
      }
    ]);
  });

  it('可加指标按维度分组后求和等于总计,行序遵循取值域声明顺序', () => {
    const total = executeDqeItem(surfaceItem({ metrics: ['Tokens消耗量'] }));
    const byRegion = executeDqeItem(
      surfaceItem({ metrics: ['Tokens消耗量'], dims: ['区域'] })
    );
    const byRegionAndModel = executeDqeItem(
      surfaceItem({ metrics: ['Tokens消耗量'], dims: ['区域', '模型'] })
    );

    expect(byRegion.code).toBe('SUCCESS');
    expect(byRegion.data.map((row) => row['区域'])).toEqual([
      '华东',
      '华南',
      '华北',
      '西南',
      '华中',
      '东北',
      '西北'
    ]);
    const grandTotal = metricOf(total, 'Tokens消耗量')[0]!;
    expect(sum(metricOf(byRegion, 'Tokens消耗量'))).toBe(grandTotal);
    expect(byRegionAndModel.data).toHaveLength(21);
    expect(sum(metricOf(byRegionAndModel, 'Tokens消耗量'))).toBe(grandTotal);
  });

  it('时间维度进入 output_dims 时按粒度展开时间桶,可加指标跨桶求和等于总计', () => {
    const total = executeDqeItem(surfaceItem({ metrics: ['Tokens请求量'] }));
    const byPeriod = executeDqeItem(
      surfaceItem({ metrics: ['Tokens请求量'], dims: ['统计周期'] })
    );

    expect(byPeriod.code).toBe('SUCCESS');
    expect(byPeriod.data.map((row) => row['统计周期'])).toEqual([
      '2026-01',
      '2026-02',
      '2026-03'
    ]);
    expect(sum(metricOf(byPeriod, 'Tokens请求量'))).toBe(
      metricOf(total, 'Tokens请求量')[0]!
    );
  });

  it('期末值指标的区间聚合等于时间分组的最后一桶', () => {
    const time = { period: 'month', start: '2026-04', end: '2026-06' };
    const aggregate = executeDqeItem(surfaceItem({ metrics: ['客户数'], dims: ['客户级别'], time }));
    const byPeriod = executeDqeItem(
      surfaceItem({
        metrics: ['客户数'],
        dims: ['客户级别', '统计周期'],
        time
      })
    );

    expect(aggregate.code).toBe('SUCCESS');
    expect(byPeriod.code).toBe('SUCCESS');
    for (const row of aggregate.data) {
      const lastBucket = byPeriod.data.find(
        (candidate) =>
          candidate['客户级别'] === row['客户级别'] &&
          candidate['统计周期'] === '2026-06'
      );
      expect(lastBucket?.['客户数']).toBe(row['客户数']);
    }
  });

  it('运营分析支持日粒度并按天展开时间桶', () => {
    const result = executeDqeItem(
      surfaceItem({
        metrics: ['Tokens消耗量'],
        dims: ['统计周期'],
        time: { period: 'day', start: '2026-07-30', end: '2026-08-02' }
      })
    );

    expect(result.code).toBe('SUCCESS');
    expect(result.data.map((row) => row['统计周期'])).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02'
    ]);
  });
});

describe('组合式语义面:筛选语义', () => {
  it('维度筛选只保留取值域内被选中的组,组值与未筛选查询一致', () => {
    const unfiltered = executeDqeItem(
      surfaceItem({ metrics: ['Tokens消耗量'], dims: ['区域'] })
    );
    const filtered = executeDqeItem(
      surfaceItem({
        metrics: ['Tokens消耗量'],
        dims: ['区域'],
        filterDims: [{ dim_name: '区域', dim_value_list: ['西南', '华东'] }]
      })
    );

    expect(filtered.code).toBe('SUCCESS');
    expect(filtered.data.map((row) => row['区域'])).toEqual(['华东', '西南']);
    for (const row of filtered.data) {
      const reference = unfiltered.data.find(
        (candidate) => candidate['区域'] === row['区域']
      );
      expect(row['Tokens消耗量']).toBe(reference?.['Tokens消耗量']);
    }
  });

  it('未入选维度的筛选参与聚合口径:筛选后的总计等于该子集分组求和', () => {
    const filterDims = [
      { dim_name: '模型', dim_value_list: ['代码大模型', '多模态大模型'] }
    ];
    const total = executeDqeItem(
      surfaceItem({ metrics: ['计费Tokens量'], filterDims })
    );
    const byModel = executeDqeItem(
      surfaceItem({ metrics: ['计费Tokens量'], dims: ['模型'], filterDims })
    );

    expect(byModel.data.map((row) => row['模型'])).toEqual([
      '代码大模型',
      '多模态大模型'
    ]);
    expect(sum(metricOf(byModel, '计费Tokens量'))).toBe(
      metricOf(total, '计费Tokens量')[0]!
    );
  });

  it('同一维度多条筛选取交集,交集为空时返回零行而不是编造数据', () => {
    const result = executeDqeItem(
      surfaceItem({
        metrics: ['Tokens消耗量'],
        dims: ['区域'],
        filterDims: [
          { dim_name: '区域', dim_value_list: ['华东'] },
          { dim_name: '区域', dim_value_list: ['华南'] }
        ]
      })
    );

    expect(result.code).toBe('SUCCESS');
    expect(result.data).toEqual([]);
    expect(result.total_count).toBe(0);
  });

  it('语义面结果支持 order 分页', () => {
    const result = executeDqeItem(
      surfaceItem({
        metrics: ['Tokens消耗量'],
        dims: ['区域'],
        order: { offset: 2, limit: 3 }
      })
    );

    expect(result.code).toBe('SUCCESS');
    expect(result.total_count).toBe(7);
    expect(result.data.map((row) => row['区域'])).toEqual(['华北', '西南', '华中']);
    expect(result.dqe.offset).toBe(2);
    expect(result.dqe.limit).toBe(3);
  });
});

describe('组合式语义面:跨域近义指标消歧', () => {
  it('仅凭「客户数」无法唯一确定业务域时拒答并列出候选域', () => {
    const result = executeDqeItem(surfaceItem({ metrics: ['客户数'] }));

    expect(result.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
    expect(result.data).toEqual([]);
    expect(result.retDesc).toContain('多个业务域');
    expect(result.retDesc).toContain('运营分析');
    expect(result.retDesc).toContain('客户经营');
  });

  it('维度或筛选可以消歧:客户级别归属客户经营,模型筛选归属运营分析', () => {
    const customerSide = executeDqeItem(
      surfaceItem({ metrics: ['客户数'], dims: ['客户级别'] })
    );
    const operationsSide = executeDqeItem(
      surfaceItem({
        metrics: ['客户数'],
        filterDims: [{ dim_name: '模型', dim_value_list: ['通用大模型'] }]
      })
    );

    expect(customerSide.code).toBe('SUCCESS');
    expect(customerSide.data.map((row) => row['客户级别'])).toEqual([
      '卓越',
      '战略',
      '核心',
      '成长'
    ]);
    expect(operationsSide.code).toBe('SUCCESS');
    expect(operationsSide.data).toHaveLength(1);
  });
});

describe('组合式语义面:面外拒答', () => {
  it.each([
    [
      '语义面外指标不出数',
      surfaceItem({ metrics: ['营业额'] })
    ],
    [
      '跨业务域组合被拒绝',
      surfaceItem({ metrics: ['Tokens消耗量'], dims: ['客户级别'] })
    ],
    [
      '取值域外的维度取值被拒绝',
      surfaceItem({
        metrics: ['Tokens消耗量'],
        dims: ['区域'],
        filterDims: [{ dim_name: '区域', dim_value_list: ['火星'] }]
      })
    ],
    [
      '业务域不支持的时间粒度被拒绝',
      surfaceItem({
        metrics: ['新增客户数'],
        time: { period: 'day', start: '2026-07-01', end: '2026-07-03' }
      })
    ],
    [
      '带 operator 的维度筛选被拒绝',
      surfaceItem({
        metrics: ['Tokens消耗量'],
        filterDims: [
          { dim_name: '区域', dim_value_list: ['华东'], operator: '<' }
        ]
      })
    ],
    [
      '非空 filter.metrics 被拒绝',
      surfaceItem({ metrics: ['Tokens消耗量'], filterMetrics: [{}] })
    ],
    [
      '时间维度不能作为维度筛选',
      surfaceItem({
        metrics: ['Tokens消耗量'],
        filterDims: [{ dim_name: '统计周期', dim_value_list: ['2026-01'] }]
      })
    ]
  ])('%s', (_name, item) => {
    const result = executeDqeItem(item);

    expect(result.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
    expect(result.data).toEqual([]);
    expect(result.total_count).toBe(0);
  });
});

describe('组合式语义面:既有精确匹配分支不受影响', () => {
  const exactItem = (levels: string[]) => ({
    output_metrics: ['NA客户数'],
    output_dims: ['客户级别'],
    filter: {
      time: { period: 'month', is_aggregate: true, start: '2026-07', end: '2026-07' },
      dims: [
        { dim_name: '地区部', dim_value_list: ['中国地区部'] },
        { dim_name: '客户级别', dim_value_list: levels }
      ],
      metrics: []
    },
    order: {}
  });

  it('存量正式页面的精确匹配查询仍返回 fixture 行', () => {
    const result = executeDqeItem(exactItem(['卓越NA', '战略NA', '核心NA']));

    expect(result.code).toBe('SUCCESS');
    expect(result.data).toEqual([
      { 客户级别: '卓越NA', NA客户数: 15 },
      { 客户级别: '战略NA', NA客户数: 12 },
      { 客户级别: '核心NA', NA客户数: 9 }
    ]);
  });

  it('精确匹配分支的拒答文案原样保留,不被语义面接管', () => {
    const result = executeDqeItem(exactItem(['未知级别']));

    expect(result.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
    expect(result.retDesc).toBe('不支持的客户级别:未知级别');
  });
});

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
