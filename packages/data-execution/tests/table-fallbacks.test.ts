import pagedFixture from '../../page/fixtures/contract-valid/table-paged-fallback-page.json';
import { parsePage } from '@metriccanvas/page';
import { reusableInitialSnapshot } from '../src/source-program/range-policy';
import { describe, expect, it, vi } from 'vitest';
import { normalizeQueryRows, projectSnapshotRows, restoreCellFallbacks, rowCellFallback, snapshotCellFallbacks, type QueryDataSourceFieldDefinition } from '@metriccanvas/page/internal';
import { applyComputation } from '../src/compute';
import { sortTableRows } from '../src/table-view';
import { queryRowsFromPageRows } from '../src/query-rows';
import { alignedCellText, projectTableRows } from '../../engine/widgets/src/components/table/rows';

const fields: Record<string, QueryDataSourceFieldDefinition> = {
  id: { queryField: 'id', type: 'string', role: 'dimension' },
  date: { queryField: 'date', type: 'date', role: 'dimension' },
  value: { queryField: 'value', type: 'number', role: 'measure' }
};
function normalized() {
  const result = normalizeQueryRows([
    { id: 'a', date: '2026-09 ~ 2026-10', value: '待确认' },
    { id: 12, date: '2026-10-01', value: '--' },
    { id: 'c', date: null, value: 0 }
  ], fields);
  if (!result.ok) throw Error('valid scalar fallback failed');
  return result;
}
describe('serializable table cell fallbacks', () => {
  it('restores serialized pagedJoin initial evidence and rejects invented display overrides', () => {
    const document = JSON.parse(JSON.stringify(pagedFixture));
    const parsed = parsePage(document);
    if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
    const source = parsed.page.dataSources['office-overview'];
    if (source.source.type !== 'pagedJoin') throw Error('fixture');
    const snapshot = reusableInitialSnapshot(source, source.source.initial?.view);
    if (snapshot?.status !== 'ready') throw Error('initial lost');
    expect(rowCellFallback(snapshot.rows[0], 'rep-office-name')?.raw).toBe(123);
    expect(rowCellFallback(snapshot.rows[0], 'region-dept-name')?.raw).toBe(true);
    document.dataSources['office-overview'].source.initial.rows[0]['bidding-amount'] = 100;
    expect(parsePage(document).ok).toBe(false);
  });
  it('aggregates format-only warnings by source and field, without values or repeated render logs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const snapshot = {status:'ready' as const, rows:[{name:'private-a'},{name:'private-b'}]};
    const data = {main:{fields:{name:{type:'string' as const,role:'dimension' as const}},snapshot,diagnostics:{componentId:'table',sourceId:'records',snapshot}}};
    const props = {columns:[{field:{data:'main',field:'name',format:'number' as const}}]};
    try {
      const rows = projectTableRows(data, props);
      expect(alignedCellText(props.columns[0].field, data, rows[0])).toBe('private-a');
      projectTableRows(data, props);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('TABLE_FORMAT_FALLBACK'),expect.objectContaining({dataSourceId:'records',fieldId:'name',count:2}));
      expect(JSON.stringify(warn.mock.calls)).not.toContain('private-a');
    } finally { warn.mockRestore(); }
  });
  it('drops stale row-index metadata when a view removes the original anomalous row', () => {
    const result = normalized();
    const snapshot = {status:'ready' as const,rows:result.rows,...snapshotCellFallbacks(result.rows)};
    const selected = JSON.parse(JSON.stringify(projectSnapshotRows(snapshot, [result.rows[2]])));
    expect(selected.cellFallbacks).toBeUndefined();
    const data = {main:{fields,snapshot:selected}};
    const rows = projectTableRows(data,{columns:[{field:'date'}]});
    expect(alignedCellText('date',data,rows[0])).toBe('—');
  });
  it('keeps malformed scalars separate from typed values and never exposes them in diagnostics', () => {
    const result = normalized();
    expect(result.rows).toEqual([{ id: 'a', date: null, value: null }, { id: null, date: '2026-10-01', value: null }, { id: 'c', date: null, value: 0 }]);
    expect(JSON.stringify(result.warnings)).not.toContain('待确认');
    const transported = JSON.parse(JSON.stringify(result));
    restoreCellFallbacks(transported.rows, transported.cellFallbacks);
    expect(queryRowsFromPageRows(transported.rows, fields)[0]).toEqual({ id: 'a', date: '2026-09 ~ 2026-10', value: '待确认' });
    expect(rowCellFallback(transported.rows[1], 'id')?.raw).toBe(12);
  });
  it('carries original cells through computed copies, sorting, pagination and cloned snapshots', () => {
    const result = normalized();
    const output = applyComputation([{ op: 'delta', minuend: 'value', subtrahend: 'value', output: 'delta' }], result.rows);
    const sorted = sortTableRows(output, [{ field: 'value', direction: 'desc' }]);
    expect(sorted.map(row => row.id)).toEqual(['c', 'a', null]);
    const payload = JSON.parse(JSON.stringify({ status: 'ready', rows: sorted.slice(1), ...snapshotCellFallbacks(sorted.slice(1)) }));
    const data = { main: { fields, snapshot: payload } };
    const rows = projectTableRows(data, { columns: [{ field: 'date' }] });
    expect(alignedCellText('date', data, rows[0])).toBe('2026-09 ~ 2026-10');
    expect(alignedCellText('id', data, rows[1])).toBe('12');
    expect(output[0].delta).toBeNull();
  });
  it('maps pivot and unique join evidence to actual destination cells without inventing aggregate text', () => {
    const input = normalized();
    const pivot = applyComputation([{ op: 'pivot', categoryField: 'id', valueField: 'value', keyFields: [], columns: [{ output: 'a-value', categories: ['a'] }] }], input.rows);
    expect(rowCellFallback(pivot[0], 'a-value')?.raw).toBe('待确认');
    const joined = applyComputation([{ op: 'joinAggregate', source: 'right', onMissing: 'null', keys: [{ local: 'id', foreign: 'id' }],
      values: [{ field: 'value', output: 'copied', aggregate: 'unique' }, { field: 'value', output: 'summed', aggregate: 'sum' }] }],
    [{ id: 'a' }], new Map([['right', [input.rows[0]]]]));
    expect(joined[0]).toEqual({ id: 'a', copied: null, summed: null });
    expect(rowCellFallback(joined[0], 'copied')?.raw).toBe('待确认');
    expect(rowCellFallback(joined[0], 'summed')).toBeUndefined();
  });
  it('keeps all dash and whitespace tokens last in both directions and preserves secondary-key order', () => {
    const values = [null, '', ' ', '-', '--', '—', '——', ' –—- ', '0', 'false', 'A-01'];
    const rows = values.map((value, index) => ({ value, index }));
    for (const direction of ['asc', 'desc'] as const) {
      const sorted = sortTableRows(rows, [{ field: 'value', direction }, { field: 'index', direction: 'asc' }]);
      expect(sorted.slice(-8).map(row => row.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    }
    expect(sortTableRows([{ v: null }, { v: false }, { v: 0 }], [{ field: 'v', direction: 'desc' }]).at(-1)?.v).toBeNull();
  });
});
