import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '../src';

function groupedPage() {
  const query = {
    language: 'dqe',
    body: {
      dsl_list: [{
        output_dims: ['区域'],
        output_metrics: ['销售额'],
        filter: { dims: [], metrics: [] },
        order: {}
      }]
    }
  } as const;

  return {
    schemaVersion: '5.0',
    id: 'grouped-page',
    dataSources: {
      current: {
        fields: {
          dimensions: {
            region: { queryField: '区域', type: 'string' }
          },
          measures: {
            revenue: {
              queryField: '销售额',
              type: 'number',
              defaultFormat: 'number-grouped'
            }
          }
        },
        source: { type: 'query', query }
      }
    },
    sections: [{
      id: 'overview',
      components: [{
        id: 'current-table',
        type: 'table',
        layout: { span: 12 },
        data: { main: 'current' },
        props: {
          columns: [
            { field: 'region', title: '区域' },
            { field: 'revenue', title: '销售额' }
          ]
        }
      }]
    }]
  };
}

describe('query 页面数据源的局部显式字段分组', () => {
  it('把 DQE 原始内嵌初始行归一化为稳定页面字段，不修改原文档', () => {
    const document: any = groupedPage();
    document.dataSources.current.source.initial = {
      capturedAt: '2026-08-05T15:32:01+08:00',
      rows: [{ 区域: '华东', 销售额: 128600 }],
      totalCount: 1
    };
    const before = structuredClone(document);

    const parsed = parsePage(document);

    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors, null, 2));
    expect(document).toEqual(before);
    const source = parsed.page.dataSources.current?.source;
    expect(source?.type).toBe('query');
    if (source?.type !== 'query') throw new Error('测试数据源必须为 query');
    expect(source.initial).toEqual({
      capturedAt: '2026-08-05T15:32:01+08:00',
      rows: [{ region: '华东', revenue: 128600 }],
      totalCount: 1
    });
  });

  it('在页面模块的解析接缝补全字段角色，不修改原文档', () => {
    const document = groupedPage();
    const before = structuredClone(document);
    const parsed = parsePage(document);

    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors, null, 2));
    expect(document).toEqual(before);
    expect(parsed.page.dataSources.current?.fields).toEqual({
      region: {
        queryField: '区域',
        type: 'string',
        role: 'dimension'
      },
      revenue: {
        queryField: '销售额',
        type: 'number',
        role: 'measure',
        defaultFormat: 'number-grouped'
      }
    });
  });

  it('可以解析响应式宿主传入的 Proxy 文档', () => {
    const document = groupedPage();
    const proxied = new Proxy(document, {});
    const parsed = parsePage(proxied);

    expect(parsed.ok).toBe(true);
    expect(document.dataSources.current.fields.dimensions.region).toEqual({
      queryField: '区域',
      type: 'string'
    });
  });

  it('拒绝依赖隐式默认值的字段声明', () => {
    const document: any = groupedPage();
    delete document.dataSources.current.fields.dimensions.region.type;

    expect(validate(document)).toContainEqual({
      type: 'SCHEMA_ERROR',
      path: '/dataSources/current/fields/dimensions/region/type',
      message: '缺少必填字段 type'
    });
  });

  it('拒绝在 dimensions 和 measures 中重复声明页面字段', () => {
    const document: any = groupedPage();
    document.dataSources.current.fields.measures.region = {
      queryField: '区域',
      type: 'string'
    };

    expect(validate(document)).toContainEqual({
      type: 'SCHEMA_ERROR',
      path: '/dataSources/current/fields/measures/region',
      message: '页面字段重复声明:region'
    });
  });

  it('拒绝使用 definitions 增加间接层', () => {
    const document: any = groupedPage();
    document.definitions = {
      fieldDefaults: { dimensions: { type: 'string' } }
    };

    expect(validate(document)).toContainEqual({
      type: 'SCHEMA_ERROR',
      path: '/definitions',
      message: '存在未定义字段 definitions(拼写错误?)'
    });
  });
});
