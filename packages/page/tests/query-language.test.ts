import { describe, expect, it } from 'vitest';
import {
  QUERY_LANGUAGES,
  declaredPaginationLimit,
  isQueryLanguage,
  type JsonObject,
  type JsonValue,
  type PageQuery
} from '../src/query';
import { validate } from '../src/validate';

function dqeQuery(order?: unknown): PageQuery {
  const item: JsonObject = {
    output_dims: ['区域'],
    output_metrics: ['销售额'],
    filter: { dims: [], metrics: [] }
  };
  if (order !== undefined) item.order = order as JsonValue;
  return {
    language: 'dqe',
    body: { dsl_list: [item] }
  };
}

function queryPage(language: string) {
  return {
    schemaVersion: '5.0',
    id: 'language-page',
    dataSources: {
      sales: {
        fields: {
          region: { queryField: '区域', type: 'string', role: 'dimension' },
          revenue: { queryField: '销售额', type: 'number', role: 'measure' }
        },
        source: {
          type: 'query',
          query: {
            language,
            body: {
              dsl_list: [
                {
                  output_dims: ['区域'],
                  output_metrics: ['销售额'],
                  filter: { dims: [], metrics: [] },
                  order: {}
                }
              ]
            }
          }
        }
      }
    },
    sections: [
      {
        id: 'main',
        components: [
          {
            id: 'table',
            type: 'table',
            layout: { span: 12 },
            data: { main: 'sales' },
            props: { columns: [{ field: 'region' }, { field: 'revenue' }] }
          }
        ]
      }
    ]
  };
}

describe('查询协议闭集(language 判别联合)', () => {
  it('闭集当前仅 dqe,isQueryLanguage 对集外取值失败关闭', () => {
    expect(QUERY_LANGUAGES).toEqual(['dqe']);
    expect(isQueryLanguage('dqe')).toBe(true);
    for (const outside of ['graphql', 'rest', 'sql', '', undefined, null, 42]) {
      expect(isQueryLanguage(outside)).toBe(false);
    }
  });

  it('页面文档校验拒绝闭集之外的 language,dqe 分支原样通过', () => {
    expect(validate(queryPage('dqe'))).toEqual([]);
    const errors = validate(queryPage('graphql'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContainEqual(
      expect.objectContaining({
        path: expect.stringContaining('/dataSources/sales/source')
      })
    );
  });
});

describe('查询定义自述的分页能力(协议中立)', () => {
  it('dqe 分支声明合法 order.limit 时返回每页行数', () => {
    expect(declaredPaginationLimit(dqeQuery({ offset: 0, limit: 10 }))).toBe(10);
  });

  it('未声明或声明不合法时返回 undefined', () => {
    expect(declaredPaginationLimit(dqeQuery())).toBeUndefined();
    expect(declaredPaginationLimit(dqeQuery({}))).toBeUndefined();
    expect(declaredPaginationLimit(dqeQuery({ limit: 0 }))).toBeUndefined();
    expect(declaredPaginationLimit(dqeQuery({ limit: -5 }))).toBeUndefined();
    expect(declaredPaginationLimit(dqeQuery({ limit: 2.5 }))).toBeUndefined();
    expect(declaredPaginationLimit(dqeQuery({ limit: '10' }))).toBeUndefined();
    expect(declaredPaginationLimit(dqeQuery('not-an-object'))).toBeUndefined();
    expect(declaredPaginationLimit(dqeQuery([{ limit: 10 }]))).toBeUndefined();
    expect(declaredPaginationLimit(dqeQuery(null))).toBeUndefined();
  });
});
