import { describe, expect, it } from 'vitest';
import type { InlineDataSource, QueryDataSource } from '../src/data-source';
import type {
  BooleanFilterDeclaration,
  DimensionFilterDeclaration,
  NumberRangeFilterDeclaration,
  SearchFilterDeclaration,
  TimePointFilterDeclaration,
  TimeRangeFilterDeclaration,
} from '../src/filter';
import { dataSourceDocumentZ } from '../src/schema/data-source';
import { filterDeclarationZ } from '../src/schema/filter';
import type {
  _DataSourceUnionParity,
  _DqeRequestBodyDomainToSchema,
  _EmbeddedInitialRowsParity,
  _FilterBooleanParity,
  _FilterDimensionParity,
  _FilterNonTimeRangeSchemaAssignableToDomain,
  _FilterNumberRangeParity,
  _FilterNumberRangeValueParity,
  _FilterRelativeTimeParity,
  _FilterSearchParity,
  _FilterTimePointParity,
  _FilterTimeRangeParity,
  _FilterUnionParity,
  _InlineDataSourceParity,
  _InlineSourceParity,
  _QueryDataSourceParity,
  _QuerySourceParity,
} from '../src/schema/type-parity';

type AllParityChecks = [
  _FilterRelativeTimeParity,
  _FilterNumberRangeValueParity,
  _FilterDimensionParity,
  _FilterTimeRangeParity,
  _FilterTimePointParity,
  _FilterBooleanParity,
  _FilterNumberRangeParity,
  _FilterSearchParity,
  _FilterUnionParity,
  _FilterNonTimeRangeSchemaAssignableToDomain,
  _DqeRequestBodyDomainToSchema,
  _InlineSourceParity,
  _InlineDataSourceParity,
  _EmbeddedInitialRowsParity,
  _QuerySourceParity,
  _QueryDataSourceParity,
  _DataSourceUnionParity,
];

describe('schema/type-parity', () => {
  it('verifies all compile-time bidirectional parity assertions resolve to true', () => {
    const verified: AllParityChecks = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ];
    expect(verified.every(Boolean)).toBe(true);
  });

  it('accepts all six domain FilterDeclaration shapes through filterDeclarationZ', () => {
    const dimension: DimensionFilterDeclaration = {
      id: 'region',
      type: 'dimension',
      dimension: 'region_code',
      label: '区域',
      display: 'select',
      default: ['CN'],
    };
    const timeRange: TimeRangeFilterDeclaration = {
      id: 'period',
      type: 'timeRange',
      display: 'period',
      periodModes: ['year', 'quarter', 'month'],
      default: { mode: 'month', value: '2026-03' },
    };
    const timePoint: TimePointFilterDeclaration = {
      id: 'snapshot-month',
      type: 'timePoint',
      granularity: 'month',
      default: '2026-03',
    };
    const boolFilter: BooleanFilterDeclaration = {
      id: 'only-key',
      type: 'boolean',
      default: true,
    };
    const numberRange: NumberRangeFilterDeclaration = {
      id: 'amount',
      type: 'numberRange',
      default: { from: 100, to: 500 },
      constraints: { min: 0, bounds: 'inclusive' },
    };
    const search: SearchFilterDeclaration = {
      id: 'keyword',
      type: 'search',
      default: 'alpha',
    };

    for (const declaration of [dimension, timeRange, timePoint, boolFilter, numberRange, search]) {
      expect(filterDeclarationZ.safeParse(declaration).success).toBe(true);
    }
  });

  it('accepts inline and query DataSource shapes through dataSourceDocumentZ', () => {
    const inlineSource: InlineDataSource = {
      fields: {
        region: { role: 'dimension', type: 'string' },
        revenue: { role: 'measure', type: 'number' },
      },
      source: {
        type: 'inline',
        rows: [{ region: 'CN', revenue: 42 }],
      },
    };
    const querySource: QueryDataSource = {
      fields: {
        region: { role: 'dimension', type: 'string', queryField: 'region_code' },
        revenue: { role: 'measure', type: 'number', queryField: 'rev' },
      },
      source: {
        type: 'query',
        resultScope: 'complete',
        initial: {
          capturedAt: '2026-03-01T00:00:00Z',
          rows: [{ region_code: 'CN', rev: 42 }],
          totalCount: 1,
        },
        query: {
          language: 'dqe',
          body: { dsl_list: [{ metric_list: ['rev'] }] },
          filterBindings: {
            period: {
              target: 'time',
              periodPolicy: { kind: 'fixed', period: 'month' },
            },
          },
        },
      },
    };

    expect(dataSourceDocumentZ.safeParse(inlineSource).success).toBe(true);
    expect(dataSourceDocumentZ.safeParse(querySource).success).toBe(true);

    // timeModes cases forbid periodPolicy (preserved by timeModeFilterBindingsZ)
    const invalidTimeMode = {
      ...querySource,
      source: {
        ...querySource.source,
        query: {
          language: 'dqe',
          timeModes: {
            filterId: 'period',
            cases: {
              day: {
                body: { dsl_list: [{ metric_list: ['rev'] }] },
                filterBindings: {
                  period: {
                    target: 'time',
                    periodPolicy: { kind: 'fixed', period: 'day' },
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(dataSourceDocumentZ.safeParse(invalidTimeMode).success).toBe(false);
  });
});
