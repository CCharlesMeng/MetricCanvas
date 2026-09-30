import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import type { OpenDetailAction } from '@metriccanvas/page/internal';
import { detailViewInput } from '../src/detail-view';
import { orchestrate } from '../src/orchestrator';
import { createFilterState } from '../src/filter-state';

function fixture() {
  const result = parsePage(JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/detail-views.json', import.meta.url), 'utf8')));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.page;
}
const action: OpenDetailAction = { on: 'click', openDetail: { surface: 'drawer', view: 'trend', bindings: { 'detail-customer': { source: 'row', field: 'name' } } } };
describe('isolated detail query input', () => {
  it('does not eagerly query parameterized views; binding is mandatory and isolated from page filters', () => {
    const page = fixture();
    let calls = 0;
    const stop = orchestrate(page, { async fetchData() { calls++; return { rows: [] }; } }).subscribe(() => {});
    expect(calls).toBe(0);
    const filters = new Map();
    const input = detailViewInput(page, action, { name: 'A' }, filters, new Map());
    expect(input.filters.get('detail-customer')).toMatchObject({ values: ['A'] });
    expect(filters.size).toBe(0);
    expect(input.page.sections[0].components[0].id).toBe('detail-table');
    expect(() => detailViewInput(page, action, {}, filters, new Map())).toThrow('缺失');
    stop();
  });
  it('closing the detail stream aborts its request and late completion cannot publish', async () => {
    const input = detailViewInput(fixture(), action, { name: 'A' }, new Map(), new Map());
    let signal: AbortSignal | undefined;
    let finish: ((result: { rows: Array<{ period: string; value: number }> }) => void) | undefined;
    let ready = 0;
    const stop = orchestrate(input.page, { fetchData(_query, _context, abort) {
      signal = abort; return new Promise(resolve => { finish = resolve; });
    } }, createFilterState(input.filters)).subscribe(snapshots => {
      if (snapshots.get('detail')?.status === 'ready') ready++;
    });
    stop();
    expect(signal?.aborted).toBe(true);
    finish?.({ rows: [{ period: 'late', value: 999 }] });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ready).toBe(0);
  });
});
