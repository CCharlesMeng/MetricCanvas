import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/ioc-opportunity-list.json';
import { executeDqeItem } from '../src/execute';
import {
  DQE_EXECUTE_PATH,
  executeFixtureItem
} from '../../../packages/embed/tests/dqe-fixture-endpoint.mjs';
import { DEFAULT_DQE_ENDPOINT } from '../../../packages/engine/data-gateway/src/dqe';
import { parsePage } from '../../../packages/page/src';

const page = JSON.parse(readFileSync('pages/ioc-opportunity-list.json', 'utf8'));
const pageItem = page.dataSources['opportunity-list'].source.query.body.dsl_list[0];

function query(
  dims: Array<Record<string, unknown>> = [],
  order: Record<string, unknown> = {}
) {
  return { ...pageItem, filter: { dims, metrics: [] }, order };
}

describe('DQE Sim 机会点清单', () => {
  it('夹具的输出字段与页面查询逐字一致，缺一项就换不出数据', () => {
    const parsed = parsePage(page);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    expect(fixture.output_dims).toEqual(pageItem.output_dims);
    expect(fixture.output_metrics).toEqual(pageItem.output_metrics);
  });

  it('层级区域的三个谓词字段各自命中，取同一个代表处不会落到上层字段', () => {
    const counts = (['geo_pc_code', 'region_dept_code', 'rep_office_code'] as const).map(
      (field, index) => {
        const value = ['R99', 'CN-EAST', 'SH-01'][index]!;
        const result = executeDqeItem(
          query([{ dim_name: field, dim_value_list: [value] }])
        );
        expect(result.code).toBe('SUCCESS');
        return result.total_count;
      }
    );
    expect(counts).toEqual([9, 3, 1]);
    // 上层编码送到下层字段上就是空集：字段选错不会悄悄换出一批别的行。
    expect(
      executeDqeItem(query([{ dim_name: 'rep_office_code', dim_value_list: ['R99'] }]))
        .total_count
    ).toBe(0);
  });

  it('只投影声明的输出字段，谓词专用列不外溢到结果行', () => {
    const [row] = executeDqeItem(query()).data;
    expect(Object.keys(row!).sort()).toEqual(
      [...fixture.output_dims, ...fixture.output_metrics].sort()
    );
    expect(row).not.toHaveProperty('rep_office_code');
  });

  it('面外维度明确拒答，不用空结果冒充不支持', () => {
    const result = executeDqeItem(
      query([{ dim_name: 'unsupported_dim', dim_value_list: ['x'] }])
    );
    expect(result.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
    expect(result.retDesc).toContain('unsupported_dim');
  });

  // 宿主在 DQE 默认端点上应答，浏览器侧 createDqeGateway() 才能不写死路径。
  it('嵌入测试宿主应答的路径就是网关的默认端点', () => {
    expect(DQE_EXECUTE_PATH).toBe(DEFAULT_DQE_ENDPOINT);
  });

  it('嵌入测试宿主的纯 node 端点与本仿真对同一请求给出同一结果', () => {
    for (const dims of [
      [],
      [{ dim_name: 'rep_office_code', dim_value_list: ['SH-01'] }],
      [{ dim_name: 'region_dept_code', dim_value_list: ['CN-EAST'] }],
      [{ dim_name: 'cloud_class', dim_value_list: ['公有云'] }]
    ]) {
      expect(executeFixtureItem(query(dims))).toEqual(executeDqeItem(query(dims)));
    }
  });

  // 服务端排序与表头区间筛选(ADR-0086)：分页下本地排序只能排到当前页。
  it('order.by 按优先级排序，表头区间筛选走带 operator 的维度谓词', () => {
    const descending = executeDqeItem(
      query([], { by: [{ field: 'bidding_amount', type: 'desc', priority: 1 }] })
    );
    expect(descending.code).toBe('SUCCESS');
    expect(descending.data.map((row) => row.bidding_amount)).toEqual(
      [...descending.data.map((row) => row.bidding_amount as number)].sort((a, b) => b - a)
    );
    expect(descending.data[0]!.opportunity_code).toBe('OPP202604004');

    const ranged = executeDqeItem(
      query([{ dim_name: 'create_time', dim_value_list: ['2025-12'], operator: '>=' }])
    );
    expect(ranged.code).toBe('SUCCESS');
    expect(
      ranged.data.every((row) => String(row.create_time) >= '2025-12')
    ).toBe(true);
    expect(ranged.total_count).toBeLessThan(10);

    expect(
      executeDqeItem(query([], { by: [{ field: 'bidding_amount', type: '随便', priority: 1 }] })).code
    ).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  });

  it('候选值查询两侧也一致，含级联收窄与越界约束的拒答', () => {
    const candidates = (dimension: string, dims: unknown[] = []) => ({
      output_dims: [dimension],
      output_metrics: [],
      filter: { dims, metrics: [] },
      order: {}
    });
    for (const item of [
      candidates('sub-industry-level2'),
      candidates('sub-industry-level2', [
        { dim_name: 'sub-industry-level1', dim_value_list: ['零售'] }
      ]),
      candidates('rep-office-code', [
        { dim_name: 'region-dept-code', dim_value_list: ['CN-EAST'] }
      ]),
      // 越界约束两侧都拒答，不是一侧静默放行。
      candidates('sub-industry-level2', [
        { dim_name: 'cloud-class', dim_value_list: ['公有云'] }
      ])
    ]) {
      expect(executeFixtureItem(item)).toEqual(executeDqeItem(item));
    }
  });
});
