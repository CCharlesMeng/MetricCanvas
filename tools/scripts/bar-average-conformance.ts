import type { InvariantDefinition } from './page-conformance-vectors';

export const barAverageInvariant: InvariantDefinition = {
  id: 'bar-series-average', description: '同一图表的当前值和前端均值字段系列，保留原类别及版本边界',
  valid: ['sdt-period-aggregation'], cases: [
    { case: 'bar-average-old-version', base: 'sdt-period-aggregation', expect: /6.103/, mutate: document => { document.schemaVersion = '6.102'; } },
    { case: 'bar-average-category-removed', base: 'sdt-period-aggregation', expect: /averageCategory/, mutate: document => { document.sections[0].components[3].props.averageCategory = '均值'; } },
    { case: 'bar-average-stacked', base: 'sdt-period-aggregation', expect: /前端均值仅支持/, mutate: document => { document.sections[0].components[3].props.stacked = true; } },
    { case: 'bar-average-line', base: 'sdt-period-aggregation', expect: /前端均值仅支持/, mutate: document => {
      document.sections[0].components[3].props.series[1] = { field: 'decision-count', aggregate: 'avg', kind: 'line', axis: 'primary' };
    } }
  ]
};
