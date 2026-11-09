import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { standardIocRegionFilter } from '@metriccanvas/page/internal';
import raw from '../../../../pages/capabilities/ioc-header/controls/ioc-header-controls.json';
import { createIocRegionDefault } from '../src/ioc-region-default';
import { candidateScopeKey, type DimensionValuesSnapshot } from '../../runtime/src/dimension-values';
import type { FilterCandidate } from '../../runtime/src';

function page() {
  const result = parsePage(raw);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  return result.page;
}
const nodes: FilterCandidate[] = [
  { level: 'region-dept', value: 'R01', label: '甲地区部' },
  { level: 'geo', value: '全球', label: '全球' },
  { level: 'office', value: 'O01', label: '甲代表处', parent: { level: 'region-dept', value: 'R01' } }
];
function receipts(candidates = nodes) {
  return new Map(standardIocRegionFilter().hierarchy!.map(level => [
    candidateScopeKey('region', level.dimension, level.id, 'context'),
    { status: 'ready', candidates } as DimensionValuesSnapshot
  ]));
}

it('prefers global over the first candidate and consumes the default only once', () => {
  const defaults = createIocRegionDefault(page(), '', new Map(), false);
  expect(defaults.take(receipts(), 'context')).toEqual({ type: 'dimension', dimension: 'geo-pc-code', level: 'geo', values: ['全球'] });
  expect(defaults.take(receipts(), 'context')).toBeUndefined();
});
it('uses the first enabled node and its own level when global is absent or disabled', () => {
  const candidates = nodes.map(node => ({ ...node, disabled: node.value === '全球' }));
  expect(createIocRegionDefault(page(), '', new Map(), false).take(receipts(candidates), 'context'))
    .toMatchObject({ dimension: 'region-dept-code', level: 'region-dept', values: ['R01'] });
  expect(createIocRegionDefault(page(), '', new Map(), false).take(receipts(nodes.filter(node => node.value !== '全球')), 'context'))
    .toMatchObject({ values: ['R01'] });
});
it.each(['region=全球&region.level=geo', 'rep-office=O01', 'region-dept=R01', 'rep-office='])('preserves URL intent: %s', search => {
  expect(createIocRegionDefault(page(), search, new Map(), false).take(receipts(), 'context')).toBeUndefined();
});
it('preserves restored empty state, explicit defaults and ordinary filters', () => {
  expect(createIocRegionDefault(page(), '', new Map(), true).take(receipts(), 'context')).toBeUndefined();
  const document = page();
  const region = document.filters!.find(filter => filter.id === 'region')!;
  if (region.type !== 'dimension') throw Error('region');
  region.default = [];
  expect(createIocRegionDefault(document, '', new Map(), false).take(receipts(), 'context')).toBeUndefined();
  delete region.default;
  document.sections.shift();
  expect(createIocRegionDefault(document, '', new Map(), false).take(receipts(), 'context')).toBeUndefined();
});
it.each(['loading', 'empty', 'unavailable', 'denied', 'error'] as const)('waits for the complete authorized tree: %s', status => {
  const defaults = createIocRegionDefault(page(), '', new Map(), false), next = receipts();
  const snapshot: DimensionValuesSnapshot = status === 'error' ? { status, error: { code: 'DQE_QUERY_REJECTED', message: 'test' } } : { status };
  next.set(candidateScopeKey('region', 'rep-office-code', 'office', 'context'), snapshot);
  expect(defaults.take(next, 'context')).toBeUndefined();
  expect(defaults.take(receipts(), 'other-context')).toBeUndefined();
  expect(defaults.take(receipts(), 'context')).toMatchObject({ values: ['全球'] });
});
it('does not reseed after a user selection or clear, or select disabled-only trees', () => {
  const defaults = createIocRegionDefault(page(), '', new Map(), false);
  defaults.cancel(false, true);
  defaults.cancel(true, true);
  expect(defaults.take(receipts(), 'context')).toBeUndefined();
  expect(createIocRegionDefault(page(), '', new Map(), false).take(receipts(nodes.map(node => ({ ...node, disabled: true }))), 'context')).toBeUndefined();
});
