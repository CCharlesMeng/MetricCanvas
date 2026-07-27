import { describe, expect, it } from 'vitest';
import {
  resolveDataSourceFields,
  type CatalogSnapshot,
  type DataSource
} from '../src';
import catalogFixture from '../fixtures/catalog.json';

const catalog = catalogFixture as CatalogSnapshot;

describe('query 页面数据源字段解析', () => {
  it('从结构化查询与元数据快照解析完整字段契约', () => {
    const source: DataSource = {
      source: {
        type: 'query',
        query: { metrics: ['gmv'], dimensions: ['stat-date'] }
      }
    };

    expect(resolveDataSourceFields(source, catalog)).toEqual({
      'stat-date': {
        type: 'date',
        role: 'dimension',
        label: '统计日期',
        format: 'date'
      },
      gmv: {
        type: 'number',
        role: 'metric',
        label: '成交总额',
        format: 'number-grouped'
      }
    });
  });

  it('只用 fieldOverrides 覆盖页面特有展示语义', () => {
    const source: DataSource = {
      fieldOverrides: {
        gmv: { label: 'GMV', format: 'compact-wan-1' }
      },
      source: {
        type: 'query',
        query: { metrics: ['gmv'], dimensions: ['region'] }
      }
    };

    expect(resolveDataSourceFields(source, catalog).gmv).toEqual({
      type: 'number',
      role: 'metric',
      label: 'GMV',
      format: 'compact-wan-1'
    });
  });

  it('inline 和 1.0 query 继续使用页面自带 fields', () => {
    const fields = {
      value: {
        type: 'number' as const,
        role: 'metric' as const,
        label: '固定值'
      }
    };

    expect(
      resolveDataSourceFields({
        fields,
        source: { type: 'inline', rows: [{ value: 1 }] }
      })
    ).toBe(fields);
    expect(
      resolveDataSourceFields({
        fields,
        source: { type: 'query', query: { metrics: ['value'] } }
      })
    ).toBe(fields);
  });
});
