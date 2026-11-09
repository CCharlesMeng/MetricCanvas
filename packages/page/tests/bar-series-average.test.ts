import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';

function example() {
  return JSON.parse(readFileSync('pages/capabilities/data/sdt-period-aggregation.json', 'utf8'));
}
it('declares current and average field series in the same chart without changing the page', () => {
  const document = example(), before = structuredClone(document);
  expect(document.sections[0].components.at(-1).props.series).toEqual([
    { field: 'decision-count', label: '当前值', unit: '次' },
    { field: 'decision-count', label: '均值', aggregate: 'avg', unit: '次' }
  ]);
  expect(parsePage(document).errors).toEqual([]);
  expect(document).toEqual(before);
});
it('gates nested average series at 6.103 and keeps ordinary series readable at 6.97', () => {
  const document = example(), chart = document.sections[0].components.pop();
  document.sections[0].components.push({ id: 'charts', type: 'compositeCard', layout: { span: 12 }, props: { components: [chart] } });
  document.schemaVersion = '6.102';
  expect(parsePage(document).errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: '/sections/0/components/3/props/components/0/props/series/1/aggregate', message: expect.stringContaining('6.103') })
  ]));
  delete chart.props.series[1].aggregate;
  document.schemaVersion = '6.97';
  expect(parsePage(document).errors).toEqual([]);
});
it.each(['sum', true, {}, ['avg'], null])('rejects malformed aggregation %j', value => {
  const document = example(); document.sections[0].components.at(-1).props.series[1].aggregate = value;
  expect(parsePage(document).errors.some(error => error.path.includes('/series/1/aggregate'))).toBe(true);
});
it.each(['stacked', 'variant', 'role', 'line'])('rejects %s mean series', kind => {
  const document = example(), props = document.sections[0].components.at(-1).props;
  if (kind === 'stacked') props.stacked = true;
  if (kind === 'variant') props.variant = 'reportForecast';
  if (kind === 'role') props.series[1].role = 'actual';
  if (kind === 'line') props.series[1] = { ...props.series[1], kind: 'line', axis: 'primary' };
  expect(parsePage(document).errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: '/sections/0/components/3/props/series/1/aggregate', message: expect.stringContaining('前端均值') })
  ]));
});
it('rejects the abandoned category option and aggregation on a constant', () => {
  const document = example(), props = document.sections[0].components.at(-1).props;
  props.averageCategory = '均值';
  expect(parsePage(document).errors.some(error => error.path.endsWith('/averageCategory'))).toBe(true);
  delete props.averageCategory;
  props.series[1] = { value: 3, aggregate: 'avg' };
  expect(parsePage(document).ok).toBe(false);
});
