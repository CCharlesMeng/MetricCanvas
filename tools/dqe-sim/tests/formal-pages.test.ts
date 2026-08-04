import { describe, expect, it } from 'vitest';
import { parsePage } from '../../../packages/page/src';
import customerActivityRiskPage from '../../../pages/customer-activity-risk-briefing.json';
import { executeDqeItem } from '../src/execute';

interface QueryDataSource {
  source: {
    query: {
      body: { dsl_list: unknown[] };
    };
  };
  fields: Record<string, { queryField: string }>;
}

const parsedPage = parsePage(customerActivityRiskPage);
if (!parsedPage.ok) {
  throw new Error(`正式页面解析失败:${JSON.stringify(parsedPage.errors)}`);
}
const customerActivityRiskSources = parsedPage.page.dataSources as unknown as
  Record<string, QueryDataSource>;

describe('正式页面 DQE 场景', () => {
  it('客户活动风险页的每条查询都能返回非空结果', () => {
    const sources = Object.values(customerActivityRiskSources);
    const items = sources.flatMap(
      (dataSource) => dataSource.source.query.body.dsl_list
    );
    const results = items.map(executeDqeItem);

    expect(results).toHaveLength(22);
    expect(results.map((result) => result.code)).toEqual(
      Array.from({ length: 22 }, () => 'SUCCESS')
    );
    expect(results.every((result) => result.data.length > 0)).toBe(true);

    results.forEach((result, index) => {
      const firstRow = result.data[0]!;
      for (const field of Object.values(sources[index]!.fields)) {
        expect(firstRow).toHaveProperty(field.queryField);
      }
    });
  });

  it('按页面筛选绑定过滤客户明细', () => {
    const item = structuredClone(
      customerActivityRiskSources['inspection-detail']!.source.query.body.dsl_list[0]
    ) as {
      filter: {
        dims: Array<{ dim_name: string; dim_value_list: string[]; operator?: string }>;
      };
    };
    item.filter.dims = [
      {
        dim_name: '代表处',
        dim_value_list: ['北京代表处']
      },
      {
        dim_name: '是否TOP100项目客户',
        dim_value_list: ['是']
      },
      {
        dim_name: '最近一次公司考察时间',
        dim_value_list: ['2026-01-01'],
        operator: '<'
      }
    ];
    (item as unknown as { order: { offset: number; limit: number } }).order = {
      offset: 10,
      limit: 10
    };

    const result = executeDqeItem(item);

    expect(result.code).toBe('SUCCESS');
    expect(result.data).toHaveLength(10);
    expect(result.total_count).toBe(20);
    expect(result.data[0]?.['客户名称']).toBe('北京代表处客户011');
    expect(
      result.data.every(
        (row) =>
          row['代表处'] === '北京代表处' &&
          (row['最近一次公司考察时间'] === null ||
            String(row['最近一次公司考察时间']) < '2026-01-01')
      )
    ).toBe(true);
  });
});
