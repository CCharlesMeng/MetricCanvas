import { expect, it } from 'vitest';
import example from '../../../../pages/capabilities/layout/metric-card-change-visibility.json';
import { parsePage, validate } from '@metriccanvas/page';
import type { ConditionContext } from '@metriccanvas/page/internal';
import { compilePresentation } from '../src/presentation';

function filtersFor(mode: 'year' | 'quarter' | 'month' | 'last12Months' | undefined): ConditionContext['filters'] {
  if (!mode) return new Map();
  if (mode === 'last12Months') return new Map([['period', { type: 'timeRange', selection: { mode } }]]);
  const values = { year: '2026', quarter: '2026-Q1', month: '2026-01' };
  return new Map([['period', { type: 'timeRange', selection: { mode, value: values[mode] } }]]);
}

it.each([
  ['year', ['同比'], ['同比', '较目标']],
  ['quarter', ['同比'], ['同比', '较目标']],
  ['month', ['环比'], ['环比', '较目标']],
  ['last12Months', [], ['较目标']],
  [undefined, [], ['较目标']]
] as const)('projects the main and secondary change items for %s', (mode, mainLabels, secondaryLabels) => {
  const parsed = parsePage(example);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const declared = parsed.page.sections[1]!.components[0]!;
  if (declared.type !== 'metricCard') throw Error('expected metric card');
  const before = structuredClone(parsed.page);
  const projected = compilePresentation(parsed.page).evaluate({ filters: filtersFor(mode) }).sections[1]!.components[0]!;
  if (projected.type !== 'metricCard') throw Error('expected projected metric card');

  expect(projected.props.rows[0]!.changes?.map(change => change.label)).toEqual(mainLabels);
  expect(projected.props.secondaryRows?.[0]?.changes?.map(change => change.label)).toEqual(secondaryLabels);
  expect(projected.props.rows[0]!.valueField).toEqual(declared.props.rows[0]!.valueField);
  expect(projected.props.secondaryRows?.[0]?.valueField).toEqual(declared.props.secondaryRows?.[0]?.valueField);
  expect(projected.data).toEqual(declared.data);
  expect(parsed.page).toEqual(before);
});

it('reports both row paths when a 6.135 document uses the new capability', () => {
  const errors = validate({ ...example, schemaVersion: '6.135' });
  for (const key of ['rows', 'secondaryRows']) {
    for (const index of [0, 1]) {
      expect(errors).toContainEqual(expect.objectContaining({
        path: `/sections/1/components/0/props/${key}/0/changes/${index}/visibleWhen`,
        message: expect.stringContaining('由 6.136 引入')
      }));
    }
  }
});

it('retains the identity of an unconditional card without a secondary panel', () => {
  const card = structuredClone(example.sections[1]!.components[0]!);
  const props = card.props;
  if (!('rows' in props)) throw Error('expected metric card');
  Reflect.deleteProperty(props, 'secondaryRows');
  for (const change of props.rows![0]!.changes) Reflect.deleteProperty(change, 'visibleWhen');
  const parsed = parsePage({
    ...example, schemaVersion: '6.135', filters: [], sections: [{ id: 'metrics', components: [card] }]
  });
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const projected = compilePresentation(parsed.page).evaluate({ filters: new Map() }).sections[0]!.components[0];
  expect(projected).toBe(parsed.page.sections[0]!.components[0]);
});
