import type { FilterValue, FilterValues } from '@metriccanvas/data-execution/runtime';
import type { FilterDeclaration } from '@metriccanvas/page/internal';
import { describe, expect, it } from 'vitest';
import { applyCommitTransition, expandIntentChanges } from '../src/filter-state/commit';
import {
  applyCandidateReceipt,
  computeBlockedFilters,
  invalidateDependents,
  propagateBlockedFilters,
  reconcileCandidateReceipt,
} from '../src/filter-state/gates';
import {
  applyLinkedDefaults,
  initializeFilterValues,
  normalizeFilterValue,
  sameFilterValue,
} from '../src/filter-state/normalize';
import type { FilterStoreContext } from '../src/filter-state/types';
import {
  filterSearch,
  hasExplicitDimensionClear,
  parseFilterSearch,
  requestsRollingFinalization,
  resolveURLRestoreValues,
} from '../src/filter-state/url';

function makeContext(
  declarations: readonly FilterDeclaration[],
  overrides: Partial<FilterStoreContext> = {},
): FilterStoreContext {
  const byId = new Map(declarations.map((declaration) => [declaration.id, declaration]));
  return {
    declarations,
    byId,
    dimensionOptions: new Map(),
    editing: {},
    skipUnrestrictedClearConfirmation: false,
    current: new Map(),
    baseline: new Map(),
    revision: 0,
    operationClock: new Date(2026, 6, 20),
    receipts: new Map(),
    preparation: new Set(),
    confirmation: new Set(),
    exclusions: new Set(),
    intersections: new Set(),
    subscribers: new Set(),
    ...overrides,
  };
}

describe('filter-state/normalize', () => {
  it('normalizes empty values to null and rejects invalid number ranges and unknown hierarchy levels', () => {
    const hierarchyDecl: FilterDeclaration = {
      id: 'org',
      type: 'dimension',
      dimension: 'global',
      hierarchy: [
        { id: 'global', dimension: 'global' },
        { id: 'office', dimension: 'office-code' },
      ],
    };

    expect(normalizeFilterValue({ type: 'dimension', dimension: 'region', values: [] })).toBeNull();
    expect(normalizeFilterValue({ type: 'search', query: '   ' })).toBeNull();
    expect(normalizeFilterValue({ type: 'numberRange' })).toBeNull();
    expect(normalizeFilterValue({ type: 'numberRange', from: 10, to: 5 })).toBeUndefined();
    expect(normalizeFilterValue({ type: 'numberRange', from: Number.NaN })).toBeUndefined();

    expect(
      normalizeFilterValue(
        { type: 'dimension', dimension: 'global', values: ['HQ'] },
        hierarchyDecl,
      ),
    ).toEqual({ type: 'dimension', dimension: 'global', level: 'global', values: ['HQ'] });
    expect(
      normalizeFilterValue(
        { type: 'dimension', dimension: 'office-code', level: 'missing', values: ['A'] },
        hierarchyDecl,
      ),
    ).toBeUndefined();
  });

  it('compares filter values structurally including dimension level and time range mode', () => {
    expect(
      sameFilterValue(
        { type: 'dimension', dimension: 'geo', level: 'geo', values: ['A'] },
        { type: 'dimension', dimension: 'geo', level: 'office', values: ['A'] },
      ),
    ).toBe(false);
    expect(
      sameFilterValue(
        { type: 'timeRange', from: '2026-01-01', to: '2026-01-31', mode: 'day' },
        { type: 'timeRange', from: '2026-01-01', to: '2026-01-31', mode: 'month' },
      ),
    ).toBe(false);
    expect(sameFilterValue(undefined, null)).toBe(true);
  });

  it('applies conditional linked defaults only when the driver value actually changes', () => {
    const declarations: FilterDeclaration[] = [
      { id: 'tier', type: 'dimension', dimension: 'tier' },
      {
        id: 'scope',
        type: 'dimension',
        dimension: 'scope',
        default: ['NA'],
        defaultWhen: { filter: 'tier', part: 'values', op: 'containsAny', values: ['VIP'] },
      },
    ];
    const current: FilterValues = new Map([
      ['tier', { type: 'dimension', dimension: 'tier', values: ['Standard'] }],
    ]);
    const normalized = new Map<string, FilterValue | null>([
      ['tier', { type: 'dimension', dimension: 'tier', values: ['VIP'] }],
    ]);

    applyLinkedDefaults(declarations, current, normalized);
    expect(normalized.get('scope')).toEqual({
      type: 'dimension',
      dimension: 'scope',
      values: ['NA'],
    });

    const unchanged = new Map<string, FilterValue | null>([
      ['tier', { type: 'dimension', dimension: 'tier', values: ['Standard'] }],
    ]);
    applyLinkedDefaults(declarations, current, unchanged);
    expect(unchanged.has('scope')).toBe(false);
  });

  it('validates initial filter values against declaration type and dimension options', () => {
    const declarations: FilterDeclaration[] = [
      { id: 'region', type: 'dimension', dimension: 'region' },
    ];
    const byId = new Map(declarations.map((d) => [d.id, d]));

    expect(() =>
      initializeFilterValues(
        new Map([['region', { type: 'boolean', value: true }]]),
        declarations,
        byId,
        new Map(),
        {},
      ),
    ).toThrow('筛选器 region 初值不符合声明');

    expect(() =>
      initializeFilterValues(
        new Map([['region', { type: 'dimension', dimension: 'region', values: ['华北'] }]]),
        declarations,
        byId,
        new Map([['region', ['华东', '华南']]]),
        {},
      ),
    ).toThrow('筛选按钮组器 region 初值不在候选项中');
  });
});

describe('filter-state/gates', () => {
  it('cascades invalidation across dependencies, tracks intersection, and respects unrestricted clear', () => {
    const declarations: FilterDeclaration[] = [
      { id: 'parent', type: 'dimension', dimension: 'parent' },
      {
        id: 'inter',
        type: 'dimension',
        dimension: 'inter',
        dependsOn: 'parent',
        candidateContext: { filterIds: ['parent'], reconcile: 'intersection' },
      },
      { id: 'optional-empty', type: 'dimension', dimension: 'opt', dependsOn: 'parent' },
      { id: 'selected-child', type: 'dimension', dimension: 'sel', dependsOn: 'parent' },
    ];
    const ctx = makeContext(declarations, {
      skipUnrestrictedClearConfirmation: true,
      current: new Map([
        ['selected-child', { type: 'dimension', dimension: 'sel', values: ['S1'] }],
      ]),
      receipts: new Map([
        ['inter', { status: 'ready', values: ['I1'] }],
        ['selected-child', { status: 'ready', values: ['S1'] }],
      ]),
    });
    const normalized = new Map<string, FilterValue | null>();

    invalidateDependents(ctx, ['parent'], normalized, false);

    expect(ctx.receipts.size).toBe(0);
    expect(ctx.intersections.has('inter')).toBe(true);
    expect(normalized.has('inter')).toBe(false);
    expect(normalized.get('optional-empty')).toBeNull();
    expect(ctx.confirmation.has('optional-empty')).toBe(false);
    expect(normalized.get('selected-child')).toBeNull();
    expect(ctx.confirmation.has('selected-child')).toBe(true);
  });

  it('reconciles candidate receipts by keeping surviving values or requesting confirmation on total loss', () => {
    const declarations: FilterDeclaration[] = [
      {
        id: 'office',
        type: 'dimension',
        dimension: 'office',
        candidateContext: { filterIds: ['parent'], reconcile: 'intersection' },
      },
      { id: 'team', type: 'dimension', dimension: 'team', dependsOn: 'office' },
    ];
    const ctx = makeContext(declarations, {
      current: new Map([
        ['office', { type: 'dimension', dimension: 'office', values: ['O1', 'O2'] }],
        ['team', { type: 'dimension', dimension: 'team', values: ['T1'] }],
      ]),
      intersections: new Set(['office']),
    });

    const partial = applyCandidateReceipt(ctx, 'office', 'ready', ['O2', 'O3']);
    expect(partial?.get('office')).toEqual({
      type: 'dimension',
      dimension: 'office',
      values: ['O2'],
    });
    expect(partial?.has('team')).toBe(false);
    expect(ctx.confirmation.has('office')).toBe(false);
    expect(ctx.confirmation.has('team')).toBe(true);
    expect(ctx.revision).toBe(1);

    ctx.current = partial!;
    const lost = reconcileCandidateReceipt(ctx, 'office', ['O9']);
    expect(lost?.has('office')).toBe(false);
    expect(ctx.confirmation.has('office')).toBe(true);
    expect(ctx.revision).toBe(2);
  });

  it('propagates blocked filters through execution dependencies while excluding overridden filters', () => {
    const declarations: FilterDeclaration[] = [
      { id: 'a', type: 'dimension', dimension: 'a' },
      { id: 'b', type: 'dimension', dimension: 'b', dependsOn: 'a' },
      { id: 'c', type: 'dimension', dimension: 'c', dependsOn: 'b' },
    ];
    expect([...propagateBlockedFilters(new Set(['a']), declarations, new Set(['b']))]).toEqual([
      'a',
    ]);
    expect([...propagateBlockedFilters(new Set(['a']), declarations, new Set())]).toEqual([
      'a',
      'b',
      'c',
    ]);

    const ctx = makeContext(declarations, {
      editing: { candidates: true },
      current: new Map([['a', { type: 'dimension', dimension: 'a', values: ['X'] }]]),
    });
    expect([...computeBlockedFilters(ctx)]).toEqual(['a', 'b', 'c']);
  });
});

describe('filter-state/url', () => {
  it('detects rolling finalization requests and explicit conditional dimension clears', () => {
    const rollingDecl: FilterDeclaration = {
      id: 'period',
      type: 'timeRange',
      display: 'period',
      precision: 'month',
      default: { mode: 'last12Months', finalizationName: '经营数据' },
      urlParams: { value: 'period', from: 'from', to: 'to' },
    };
    expect(
      requestsRollingFinalization(rollingDecl, new URLSearchParams('period=last12Months')),
    ).toBe(true);
    expect(
      requestsRollingFinalization(
        rollingDecl,
        new URLSearchParams('period=last12Months&from=2025-07&to=2026-06'),
      ),
    ).toBe(false);

    const conditionalDecl: FilterDeclaration = {
      id: 'scope',
      type: 'dimension',
      dimension: 'scope',
      default: ['NA'],
      defaultWhen: { filter: 'tier', part: 'values', op: 'containsAny', values: ['VIP'] },
    };
    expect(hasExplicitDimensionClear(conditionalDecl, new URLSearchParams('scope='), 'scope')).toBe(
      true,
    );
    expect(
      hasExplicitDimensionClear(conditionalDecl, new URLSearchParams('scope=NA'), 'scope'),
    ).toBe(false);
  });

  it('restores URL values while preserving urlParams=false filters and single-select fallbacks', () => {
    const declarations: FilterDeclaration[] = [
      { id: 'local', type: 'dimension', dimension: 'local', urlParams: false },
      {
        id: 'single',
        type: 'dimension',
        dimension: 'single',
        selection: { mode: 'single' },
        default: ['A'],
      },
      { id: 'keyword', type: 'search' },
    ];
    const ctx = makeContext(declarations, {
      current: new Map([
        ['local', { type: 'dimension', dimension: 'local', values: ['L1'] }],
        ['single', { type: 'dimension', dimension: 'single', values: ['B'] }],
      ]),
    });

    const restored = resolveURLRestoreValues(ctx, '?single=X&single=Y&keyword=cloud', declarations);
    expect(restored.get('local')).toEqual({
      type: 'dimension',
      dimension: 'local',
      values: ['L1'],
    });
    expect(restored.get('single')).toEqual({
      type: 'dimension',
      dimension: 'single',
      values: ['B'],
    });
    expect(restored.get('keyword')).toEqual({ type: 'search', query: 'cloud' });

    const serialized = filterSearch(restored, declarations);
    expect(parseFilterSearch(serialized, declarations).get('keyword')).toEqual({
      type: 'search',
      query: 'cloud',
    });
  });
});

describe('filter-state/commit', () => {
  it('expands reset and restore intents over baseline and known declarations', () => {
    const declarations: FilterDeclaration[] = [
      { id: 'a', type: 'boolean' },
      { id: 'b', type: 'search' },
    ];
    const ctx = makeContext(declarations, {
      baseline: new Map([['a', { type: 'boolean', value: true }]]),
      current: new Map([
        ['a', { type: 'boolean', value: false }],
        ['b', { type: 'search', query: 'hi' }],
      ]),
    });

    expect(expandIntentChanges(ctx, { type: 'reset', baseline: 'initial' })).toEqual([
      ['a', { type: 'boolean', value: true }],
      ['b', null],
    ]);
  });

  it('rejects edits in readOnly mode without mutating state while permitting trusted restores', () => {
    const declarations: FilterDeclaration[] = [{ id: 'flag', type: 'boolean' }];
    const ctx = makeContext(declarations, {
      editing: { readOnly: () => true, now: () => new Date(2026, 6, 21) },
      confirmation: new Set(['flag']),
    });

    const rejected = applyCommitTransition(ctx, {
      type: 'set',
      filterId: 'flag',
      value: { type: 'boolean', value: true },
    });
    expect(rejected.ok).toBe(false);
    expect(ctx.revision).toBe(0);
    expect(ctx.confirmation.has('flag')).toBe(true);

    const restored = applyCommitTransition(ctx, {
      type: 'restore',
      values: new Map([['flag', { type: 'boolean', value: true }]]),
    });
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.changedIds).toEqual(['flag']);
      expect(restored.next?.get('flag')).toEqual({ type: 'boolean', value: true });
    }
    expect(ctx.revision).toBe(1);
    expect(ctx.confirmation.has('flag')).toBe(false);
  });
});
