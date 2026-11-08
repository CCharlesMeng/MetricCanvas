import type { InvariantDefinition } from './page-conformance-vectors';

export const periodAggregationInvariant: InvariantDefinition = {
  id: 'period-aggregation', description: '近一年按业务维度逐字段求和/取月均值平均，完整输入及版本约束',
  valid: ['sdt-period-aggregation'], cases: [
    { case: 'period-aggregation-old-version', base: 'sdt-period-aggregation', expect: /6.97/, mutate: document => { document.schemaVersion = '6.96'; } },
    { case: 'period-aggregation-unknown-field', base: 'sdt-period-aggregation', expect: /数值度量/, mutate: document => { document.dataSources['rep-office-efficiency'].source.query.periodAggregation.cases.last12Months.aggregations[0].field = 'missing'; } },
    { case: 'period-aggregation-duplicate-field', base: 'sdt-period-aggregation', expect: /重复/, mutate: document => { const entries = document.dataSources['rep-office-efficiency'].source.query.periodAggregation.cases.last12Months.aggregations; entries.push(entries[0]); } },
    { case: 'period-aggregation-incomplete-source', base: 'sdt-period-aggregation', expect: /complete/, mutate: document => { delete document.dataSources['rep-office-efficiency'].source.resultScope; } },
    { case: 'period-aggregation-unknown-method', base: 'sdt-period-aggregation', expect: /允许范围/, mutate: document => { document.dataSources['rep-office-efficiency'].source.query.periodAggregation.cases.last12Months.aggregations[0].aggregate = 'max'; } }
  ]
};
