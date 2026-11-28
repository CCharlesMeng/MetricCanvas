import {
  candidateContextKey,
  filterCandidatesRequest,
  validFilterCandidates,
} from '@metriccanvas/data-execution/runtime';
import type { FilterDeclaration } from '@metriccanvas/page/internal';
import { describe, expect, it } from 'vitest';
import { createFilterState, type FilterValue } from '../src/filter-state';

const dim = (dimension: string, ...values: string[]): FilterValue => ({
  type: 'dimension',
  dimension,
  values,
});
describe('business selection and dependencies share coordinator', () => {
  it('rejects an entire group for a disabled enum or invalid single/required choice', () => {
    const defs: FilterDeclaration[] = [
      {
        id: 'choice',
        type: 'dimension',
        dimension: 'kind',
        options: [
          { value: '1', label: '是' },
          { value: '0', label: '否', disabled: true },
        ],
        selection: { mode: 'single', required: true },
      },
      { id: 'note', type: 'search' },
    ];
    const state = createFilterState(new Map([['choice', dim('kind', '1')]]), defs);
    let calls = 0;
    state.subscribe(() => calls++);
    state.writeMany([
      ['note', { type: 'search', query: 'changed' }],
      ['choice', dim('kind', '0')],
    ]);
    expect(calls).toBe(1);
    expect(state.toURL()).not.toContain('changed');
    state.write('choice', null);
    state.write('choice', dim('kind', '1', '0'));
    expect(calls).toBe(1);
    expect(() => createFilterState(new Map([['choice', dim('kind', '0')]]), defs)).toThrow();
  });
  it('intersects only a current complete ready receipt; empty intersection stays gated until explicit clear', () => {
    const defs: FilterDeclaration[] = [
      { id: 'month', type: 'timePoint', granularity: 'month', disableFuture: false },
      {
        id: 'model',
        type: 'dimension',
        dimension: 'model',
        candidateContext: { filterIds: ['month'], reconcile: 'intersection' },
      },
    ];
    const state = createFilterState(
      new Map([
        ['month', { type: 'timePoint', granularity: 'month', value: '2026-08' }],
        ['model', dim('model', 'A', 'B')],
      ]),
      defs,
      new Map(),
      { candidates: true },
    );
    state.candidate('model', 'ready', ['A', 'B']);
    expect([...state.blocked()]).toEqual([]);
    state.write('month', { type: 'timePoint', granularity: 'month', value: '2026-09' });
    expect(state.blocked().has('model')).toBe(true);
    state.candidate('model', 'denied');
    expect(state.toURL()).toContain('A');
    state.candidate('model', 'ready', ['B', 'C']);
    expect(state.toURL()).not.toContain('model=A');
    expect(state.toURL()).toContain('model=B');
    expect([...state.blocked()]).toEqual([]);
    state.write('month', { type: 'timePoint', granularity: 'month', value: '2026-10' });
    state.candidate('model', 'ready', ['C']);
    expect(state.blocked().has('model')).toBe(true);
    state.candidate('model', 'ready', ['C']);
    expect(state.blocked().has('model')).toBe(true);
    state.write('model', null);
    expect([...state.blocked()]).toEqual([]);
  });
  it('keeps a target empty level for the explicit structure tree', () => {
    const defs: FilterDeclaration[] = [
      {
        id: 'tree',
        type: 'dimension',
        dimension: 'department',
        display: 'tree',
        treeSelection: 'level',
        hierarchy: [
          { id: 'd', dimension: 'department' },
          { id: 'o', dimension: 'office' },
        ],
      },
    ];
    const state = createFilterState(undefined, defs);
    state.write('tree', { type: 'dimension', dimension: 'office', level: 'o', values: [] });
    expect(state.toURL()).toContain('tree.level=o');
  });
  it('projects actual month/range and full ancestry identity without parsing business codes', () => {
    const defs: FilterDeclaration[] = [
      { id: 'month', type: 'timePoint', granularity: 'month' },
      { id: 'region', type: 'dimension', dimension: 'geo' },
      {
        id: 'model',
        type: 'dimension',
        dimension: 'model',
        candidateContext: { filterIds: ['month', 'region'], reconcile: 'clear' },
      },
    ];
    const model = defs[2];
    if (model.type !== 'dimension') throw Error();
    const values = new Map([
      ['month', { type: 'timePoint', granularity: 'month', value: '2026-09' }],
      ['region', dim('geo', 'CN')],
    ] as Array<[string, FilterValue]>);
    expect(filterCandidatesRequest(model, defs, values).constraints).toEqual({
      dimensions: { geo: ['CN'] },
      times: { month: { from: '2026-09', to: '2026-09' } },
    });
    const old = candidateContextKey(model, defs, values);
    values.set('month', { type: 'timePoint', granularity: 'month', value: '2026-08' });
    expect(candidateContextKey(model, defs, values)).not.toBe(old);
    expect(
      validFilterCandidates(
        [
          { level: 'd', value: 'same', label: '部门' },
          { level: 'o', value: 'same', label: '代表处', parent: { level: 'd', value: 'same' } },
        ],
        ['d', 'o'],
      ),
    ).toBe(true);
    expect(
      validFilterCandidates(
        [{ level: 'd', value: 'bad', label: '坏', parent: { level: 'd', value: 'bad' } }],
        ['d', 'o'],
      ),
    ).toBe(false);
  });
});

it('a ready descendant cannot run before its intersection ancestor becomes trustworthy', () => {
  const defs: FilterDeclaration[] = [
    { id: 'month', type: 'timePoint', granularity: 'month', disableFuture: false },
    {
      id: 'a',
      type: 'dimension',
      dimension: 'a',
      candidateContext: { filterIds: ['month'], reconcile: 'intersection' },
    },
    {
      id: 'b',
      type: 'dimension',
      dimension: 'b',
      candidateContext: { filterIds: ['a'], reconcile: 'intersection' },
    },
  ];
  const state = createFilterState(
    new Map([
      ['month', { type: 'timePoint', granularity: 'month', value: '2026-08' }],
      ['a', dim('a', 'A')],
      ['b', dim('b', 'B')],
    ]),
    defs,
    new Map(),
    { candidates: true },
  );
  state.candidate('a', 'ready', ['A']);
  state.candidate('b', 'ready', ['B']);
  expect([...state.blocked()]).toEqual([]);
  state.write('month', { type: 'timePoint', granularity: 'month', value: '2026-09' });
  state.candidate('b', 'ready', ['B']);
  expect(state.blocked().has('b')).toBe(true);
  state.candidate('a', 'denied');
  expect(state.blocked().has('b')).toBe(true);
  state.candidate('a', 'ready', ['A']);
  expect([...state.blocked()]).toEqual([]);
});

it.each(['6.123', '6.124'])(
  'keeps the candidate gate for an empty dimension after a scope change in %s',
  (schemaVersion) => {
    const declarations: FilterDeclaration[] = [
      {
        id: 'region',
        type: 'dimension',
        dimension: 'region',
        options: [
          { value: '甲', label: '甲' },
          { value: '乙', label: '乙' },
        ],
      },
      {
        id: 'service',
        type: 'dimension',
        dimension: 'service',
        candidateContext: { filterIds: ['region'], reconcile: 'clear' },
      },
    ];
    const state = createFilterState(
      new Map([['region', dim('region', '甲')]]),
      declarations,
      new Map(),
      {
        candidates: true,
        schemaVersion,
      },
    );
    state.candidate('service', 'ready', ['甲服务']);
    expect(state.blocked()).not.toContain('service');

    state.write('region', dim('region', '乙'));
    expect(state.blocked()).toContain('service');
    expect(state.confirmation().has('service')).toBe(schemaVersion === '6.123');
    for (const result of ['loading', 'denied', 'empty', 'unconfigured', 'error'] as const) {
      state.candidate('service', result);
      expect(state.blocked()).toContain('service');
    }
    state.candidate('service', 'ready', ['乙服务']);
    expect(state.blocked().has('service')).toBe(schemaVersion === '6.123');
  },
);

it('preserves confirmation across further scope changes after a real selection is lost', () => {
  const declarations: FilterDeclaration[] = [
    { id: 'region', type: 'dimension', dimension: 'region' },
    {
      id: 'service',
      type: 'dimension',
      dimension: 'service',
      candidateContext: { filterIds: ['region'], reconcile: 'clear' },
    },
  ];
  const state = createFilterState(
    new Map([
      ['region', dim('region', '甲')],
      ['service', dim('service', '甲服务')],
    ]),
    declarations,
    new Map(),
    { schemaVersion: '6.124' },
  );
  state.write('region', dim('region', '乙'));
  expect(state.toURL()).not.toContain('service=');
  expect(state.confirmation()).toContain('service');
  state.write('region', dim('region', '丙'));
  expect(state.blocked()).toContain('service');
  state.write('service', null);
  expect(state.confirmation()).not.toContain('service');
});

it('keeps required and level-based empty dimensions on their original confirmation path', () => {
  const declarations: FilterDeclaration[] = [
    { id: 'region', type: 'dimension', dimension: 'region' },
    {
      id: 'required',
      type: 'dimension',
      dimension: 'required',
      selection: { mode: 'single', required: true },
      clearOnChangeOf: ['region'],
    },
    {
      id: 'tree',
      type: 'dimension',
      dimension: 'office',
      treeSelection: 'level',
      hierarchy: [{ id: 'office', dimension: 'office' }],
      clearOnChangeOf: ['region'],
    },
  ];
  const values = new Map([
    ['region', dim('region', '甲')],
    ['tree', { ...dim('office'), level: 'office' } as FilterValue],
  ]);
  const state = createFilterState(values, declarations, new Map(), { schemaVersion: '6.124' });
  state.write('region', dim('region', '乙'));
  expect(state.confirmation()).toEqual(new Set(['required', 'tree']));
  expect(state.blocked()).toContain('required');
});
