import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';

function example() {
  return JSON.parse(readFileSync('pages/capabilities/data/sdt-period-aggregation.json', 'utf8'));
}
it('accepts the declared field/aggregate shape and preserves the source document', () => {
  const document = example(), before = structuredClone(document);
  const result = parsePage(document);
  expect(result.ok ? [] : result.errors).toEqual([]);
  expect(document).toEqual(before);
  expect(document.dataSources['rep-office-efficiency'].source.query.periodAggregation).toEqual({
    filterId: 'period', cases: { last12Months: { groupBy: ['rep-office'], aggregations: [
      { field: 'decision-count', aggregate: 'sum' }, { field: 'avg-decision-time', aggregate: 'avg' }
    ] } }
  });
});
it.each([
  ['unknown field', 'field', 'absent', /数值度量/],
  ['invalid operator', 'aggregate', 'max', /允许范围/]
])('rejects %s with the declaration path', (_name, key, value, message) => {
  const document = example();
  document.dataSources['rep-office-efficiency'].source.query.periodAggregation.cases.last12Months.aggregations[0][key] = value;
  const result = parsePage(document);
  expect(result.ok).toBe(false);
  expect(result.errors.some(error => error.path.includes('/periodAggregation') && message.test(error.message))).toBe(true);
});
it('rejects duplicate, omitted and dimension aggregation fields', () => {
  const document = example(), config = document.dataSources['rep-office-efficiency'].source.query.periodAggregation.cases.last12Months;
  config.aggregations[1].field = 'decision-count';
  expect(parsePage(document).errors.map(error => error.message)).toEqual(expect.arrayContaining([
    expect.stringContaining('重复'), expect.stringContaining('avg-decision-time')
  ]));
  config.aggregations[1].field = 'rep-office';
  expect(parsePage(document).errors.some(error => error.message.includes('数值度量'))).toBe(true);
});
it('requires the period control, complete monthly source and no unproved initial/window', () => {
  const document = example(), source = document.dataSources['rep-office-efficiency'].source;
  source.query.periodAggregation.filterId = 'missing';
  delete source.resultScope;
  source.initial = { capturedAt: '2026-10-01T00:00:00Z', rows: [] };
  source.query.body.dsl_list[0].order.limit = 10;
  const messages = parsePage(document).errors.map(error => error.message).join('\n');
  expect(messages).toMatch(/时间筛选/);
  expect(messages).toMatch(/complete/);
  expect(messages).toMatch(/initial/);
  expect(messages).toMatch(/窗口/);
});
it('gates the new capability at 6.97 while old pages without it remain readable', () => {
  const document = example(); document.schemaVersion = '6.96';
  delete document.sections[0].components.at(-1).props.series[1].aggregate;
  expect(parsePage(document).errors.some(error => error.message.includes('6.97'))).toBe(true);
  delete document.dataSources['rep-office-efficiency'].source.query.periodAggregation;
  expect(parsePage(document).ok).toBe(true);
});
