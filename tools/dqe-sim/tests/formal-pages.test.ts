import { describe, expect, it } from 'vitest';
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

const customerActivityRiskSources = customerActivityRiskPage.dataSources as unknown as
  Record<string, QueryDataSource>;

describe('正式页面 DQE 场景', () => {
  it('客户活动风险页的每条查询都能返回非空结果', () => {
    const sources = Object.values(customerActivityRiskSources);
    const items = sources.flatMap(
      (dataSource) => dataSource.source.query.body.dsl_list
    );
    const results = items.map(executeDqeItem);

    expect(results).toHaveLength(21);
    expect(results.map((result) => result.code)).toEqual(
      Array.from({ length: 21 }, () => 'SUCCESS')
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
        dims: Array<{ dim_name: string; dim_value_list: string[] }>;
      };
    };
    item.filter.dims = [
      {
        dim_name: 'representative-office',
        dim_value_list: ['XX代表处09']
      },
      {
        dim_name: 'customer-scope',
        dim_value_list: ['TOP100']
      }
    ];

    const result = executeDqeItem(item);

    expect(result.code).toBe('SUCCESS');
    expect(result.data).toHaveLength(153);
    expect(
      result.data.every(
        (row) =>
          row['representative-office'] === 'XX代表处09' &&
          row['customer-scope'] === 'TOP100'
      )
    ).toBe(true);
  });
});
