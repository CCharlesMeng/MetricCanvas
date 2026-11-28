import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import inlineReport from '../fixtures/contract-valid/inline-report.json';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';
import { validate } from '../src';
import { ERROR_TYPES } from '../src/errors';

describe('ERROR_TYPES 闭集与字段契约错误分类', () => {
  it('ERROR_TYPES 闭集完整且与跨语言契约快照一致', () => {
    const contractPath = resolve(
      import.meta.dirname,
      '../../../contracts/metriccanvas/page/error-types.json',
    );
    const contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as {
      types: string[];
    };
    expect([...ERROR_TYPES]).toEqual([
      'SCHEMA_ERROR',
      'CHART_OPTION_ERROR',
      'FIELD_CONTRACT_ERROR',
      'QUERY_MAPPING_ERROR',
      'FILTER_BINDING_ERROR',
      'DQE_PROTOCOL_ERROR',
      'DQE_EXECUTION_ERROR',
      'DATA_CONTEXT_ERROR',
    ]);
    expect(contract.types).toEqual([...ERROR_TYPES]);
  });

  it('inline 数据行违背结果字段契约时发射 FIELD_CONTRACT_ERROR', () => {
    const document = structuredClone(inlineReport) as Record<string, any>;
    document.dataSources.overview.source.rows = [
      { gmv: 'not-number', unexpected: 1 },
      {},
      { gmv: null },
    ];

    const errors = validate(document);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'FIELD_CONTRACT_ERROR',
          path: '/dataSources/overview/source/rows/0/unexpected',
        }),
        expect.objectContaining({
          type: 'FIELD_CONTRACT_ERROR',
          path: '/dataSources/overview/source/rows/0/gmv',
        }),
        expect.objectContaining({
          type: 'FIELD_CONTRACT_ERROR',
          path: '/dataSources/overview/source/rows/1/gmv',
        }),
        expect.objectContaining({
          type: 'FIELD_CONTRACT_ERROR',
          path: '/dataSources/overview/source/rows/2/gmv',
        }),
      ]),
    );
  });

  it('query 内嵌初始行缺少映射字段时发射 FIELD_CONTRACT_ERROR', () => {
    const document = structuredClone(queryDashboard) as Record<string, any>;
    document.dataSources.sales.source.initial = {
      capturedAt: '2026-08-05T00:00:00+08:00',
      rows: [{ gmv: 100 }],
      totalCount: 1,
    };

    const errors = validate(document);
    expect(errors).toContainEqual(
      expect.objectContaining({
        type: 'FIELD_CONTRACT_ERROR',
        path: '/dataSources/sales/source/initial/rows/0/region',
      }),
    );
  });

  it('静态结构、图表配置、查询映射与筛选绑定分别发射对应错误类型', () => {
    // SCHEMA_ERROR
    expect(validate({ ...structuredClone(inlineReport), id: 'Invalid ID!' })).toContainEqual(
      expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/id' }),
    );

    // QUERY_MAPPING_ERROR
    const badMapping = structuredClone(queryDashboard) as Record<string, any>;
    badMapping.dataSources.sales.fields.region.queryField = 'nonexistent_output';
    expect(validate(badMapping)).toContainEqual(
      expect.objectContaining({
        type: 'QUERY_MAPPING_ERROR',
        path: '/dataSources/sales/fields/region/queryField',
      }),
    );

    // FILTER_BINDING_ERROR
    const badFilter = structuredClone(queryDashboard) as Record<string, any>;
    badFilter.dataSources.sales.source.query.filterBindings = {
      'unknown-filter': { target: 'dimension', queryField: 'region' },
    };
    expect(validate(badFilter)).toContainEqual(
      expect.objectContaining({
        type: 'FILTER_BINDING_ERROR',
        path: '/dataSources/sales/source/query/filterBindings/unknown-filter',
      }),
    );

    // CHART_OPTION_ERROR
    const badChart = structuredClone(inlineReport) as Record<string, any>;
    badChart.schemaVersion = '6.32';
    badChart.sections[0].components.push({
      id: 'trend',
      type: 'lineChart',
      layout: { span: 12 },
      data: { main: 'overview' },
      props: {
        xField: 'gmv',
        series: [{ field: 'gmv', label: 'GMV' }],
        echartsOption: { series: [{ data: [1, 2, 3] }] },
      },
    });
    expect(validate(badChart)).toContainEqual(
      expect.objectContaining({
        type: 'CHART_OPTION_ERROR',
        path: '/sections/0/components/2/props/echartsOption/series/0/data',
      }),
    );
  });
});
