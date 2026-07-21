import { describe, expect, it } from 'vitest';
import { validate, type CatalogSnapshot } from '../src';
import catalogFixture from '../fixtures/catalog.json';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';

const catalog = catalogFixture as CatalogSnapshot;

describe('query data source 目录语义校验', () => {
  it('合法 query 通过；未知指标、维度与聚合定位到 data source', () => {
    expect(validate(queryDashboard, catalog)).toEqual([]);

    const unknownMetric: any = structuredClone(queryDashboard);
    unknownMetric.dataSources.sales.source.query.metrics.push('cash-flow');
    unknownMetric.dataSources.sales.fields['cash-flow'] = {
      type: 'number',
      role: 'metric'
    };
    expect(validate(unknownMetric, catalog)).toContainEqual(
      expect.objectContaining({
        type: 'METRIC_GAP',
        path: '/dataSources/sales/source/query/metrics/1'
      })
    );

    const unknownDimension: any = structuredClone(queryDashboard);
    unknownDimension.dataSources.sales.source.query.dimensions = ['unknown-dimension'];
    delete unknownDimension.dataSources.sales.fields.region;
    unknownDimension.dataSources.sales.fields['unknown-dimension'] = {
      type: 'string',
      role: 'dimension'
    };
    expect(validate(unknownDimension, catalog)).toContainEqual(
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/dataSources/sales/source/query/dimensions/0'
      })
    );

    const badAggregation: any = structuredClone(queryDashboard);
    badAggregation.dataSources.sales.source.query.aggregation = 'count';
    expect(validate(badAggregation, catalog)).toContainEqual(
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/dataSources/sales/source/query/aggregation'
      })
    );
  });

  it('不传 catalog 时不猜测供给侧语义', () => {
    const document: any = structuredClone(queryDashboard);
    document.dataSources.sales.source.query.metrics = ['cash-flow'];
    delete document.dataSources.sales.fields.gmv;
    document.dataSources.sales.fields['cash-flow'] = {
      type: 'number',
      role: 'metric'
    };
    document.sections[0].components[0].props.columns[1].field = 'cash-flow';
    expect(validate(document)).toEqual([]);
  });
});
