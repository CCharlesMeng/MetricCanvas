import { describe, expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';

function multipleQueries() {
  const document = structuredClone(queryDashboard);
  const queries = document.dataSources.sales.source.query.body.dsl_list;
  queries.push(...structuredClone(queries), ...structuredClone(queries), ...structuredClone(queries));
  return document;
}

describe('页面数据源结构诊断', () => {
  it('只报告已声明 query 分支的真实错误，不混入其他数据源的字段要求', () => {
    const document = multipleQueries();
    const before = JSON.stringify(document);
    expect(parsePage(document).errors).toEqual([{
      type: 'SCHEMA_ERROR',
      path: '/dataSources/sales/source/query/body/dsl_list',
      message: '每个查询定义必须且只能包含 1 条查询，当前为 4 条。请将多条查询拆为独立页面数据源，再按需关联展示。'
    }]);
    expect(JSON.stringify(document)).toBe(before);
  });

  it('保留独立数据源中的其他真实错误', () => {
    const document = multipleQueries();
    const other = structuredClone(document.dataSources.sales);
    other.source.query.body.dsl_list = [];
    const input = { ...document, dataSources: { ...document.dataSources, other } };
    expect(parsePage(input).errors.map(error => error.path)).toEqual([
      '/dataSources/sales/source/query/body/dsl_list',
      '/dataSources/other/source/query/body/dsl_list'
    ]);
  });

  it('未知类型定位到 source.type，允许值由产品 Schema 提供', () => {
    const document = structuredClone(queryDashboard);
    const source = { ...document.dataSources.sales.source, type: 'qurey' };
    const input = { ...document, dataSources: { sales: { ...document.dataSources.sales, source } } };
    expect(parsePage(input).errors).toEqual([expect.objectContaining({
      path: '/dataSources/sales/source/type',
      message: expect.stringContaining('query')
    })]);
  });

  it('合法查询仍通过原有完整校验', () => {
    expect(parsePage(queryDashboard).ok).toBe(true);
  });

  it('不隐藏同一查询中的独立字段错误', () => {
    const document = multipleQueries();
    const input = { ...document, dataSources: { sales: {
      ...document.dataSources.sales, unexpected: true
    } } };
    expect(parsePage(input).errors.map(error => error.path)).toEqual([
      '/dataSources/sales/unexpected',
      '/dataSources/sales/source/query/body/dsl_list'
    ]);
  });

  it('未声明 source.type 时保留原始结构失败，不猜测数据源类型', () => {
    const document = structuredClone(queryDashboard);
    const input = { ...document, dataSources: { sales: {
      ...document.dataSources.sales, source: { query: document.dataSources.sales.source.query }
    } } };
    expect(parsePage(input).ok).toBe(false);
    expect(parsePage(input).errors).toContainEqual(expect.objectContaining({
      path: '/dataSources/sales/source/type'
    }));
  });
});
