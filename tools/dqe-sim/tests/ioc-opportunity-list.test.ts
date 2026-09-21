import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/ioc-opportunity-list.json';
import { executeDqeItem } from '../src/execute';
import { executeFixtureItem } from '../../../packages/embed/tests/dqe-fixture-endpoint.mjs';
import { parsePage } from '../../../packages/page/src';

const page = JSON.parse(readFileSync('pages/ioc-opportunity-list.json', 'utf8'));
const pageItem = page.dataSources['opportunity-list'].source.query.body.dsl_list[0];

function query(dims: Array<{ dim_name: string; dim_value_list: string[] }> = []) {
  return { ...pageItem, filter: { dims, metrics: [] }, order: {} };
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
