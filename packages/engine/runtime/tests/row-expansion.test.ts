import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import type { TableComponent, EffectiveQuery, Row } from '@metriccanvas/page/internal';
import { createRowExpansionController } from '../src/table/expansion';
import { orchestrate } from '../src/orchestrator';
import { initialQuerySourceIds } from '../../../data-execution/src/source-scope';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture(kind = 'query'): { page: Page; table: TableComponent; rows: Row[] } {
  const parsed = parsePage(JSON.parse(readFileSync(new URL(`../../../page/fixtures/contract-valid/table-row-expansion-${kind}.json`, import.meta.url), 'utf8')));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page, table = page.sections[0]!.components[0] as TableComponent, source = page.dataSources.customers!;
  if (source.source.type !== 'inline') throw Error('fixture');
  return { page, table, rows: source.source.rows };
}
function result(query: EffectiveQuery) {
  const id = query.filterValues.find(value => value.target === 'dimension');
  const customer = id?.target === 'dimension' ? id.values[0] : 'none';
  const all = Array.from({ length: 25 }, (_, index) => ({ 'customer-id': String(customer), 'order-id': `${customer}-${index}`, product: `产品${index}`, amount: index }));
  const matching = query.search ? all.filter(row => row.product.includes(query.search!.query)) : all;
  return { rows: matching.slice(query.pagination!.offset, query.pagination!.offset + query.pagination!.limit), totalCount: matching.length };
}

describe('isolated expanded table scopes', () => {
  it('does not execute child queries until expansion, including the initial page program', async () => {
    const { page } = fixture(); let calls = 0;
    expect(initialQuerySourceIds(page)).toEqual([]);
    const stop = orchestrate(page, { async fetchData() { calls++; return { rows: [] }; } }).subscribe(() => {});
    await flush(); expect(calls).toBe(0); stop();
  });
  it('keeps parent predicates, pages, page sizes and searches independent; ties use the mapped row key', async () => {
    const { page, table, rows } = fixture(), received: EffectiveQuery[] = [], filters = new Map();
    const controller = createRowExpansionController(page, table, { async fetchData(query) { received.push(query); return result(query); } }, filters, new Map(), () => {});
    controller.toggle(rows[0]!); controller.toggle(rows[1]!); await flush();
    expect(received).toHaveLength(2); expect(filters.size).toBe(0);
    expect(received[0]!.sort).toEqual([{ queryField: 'row_order_id', direction: 'asc' }]);
    const first = controller.get(rows[0]!)!, second = controller.get(rows[1]!)!;
    first.stream!.setQueryPage(first.table.data.main, 1); await flush();
    expect(received.at(-1)!.pagination).toEqual({ offset: 10, limit: 10 });
    expect(second.stream!.getQueryView(second.table.data.main)!.pageIndex).toBe(0);
    first.stream!.setQuerySort(first.table.data.main, [{ field: 'product', direction: 'desc' }]); await flush();
    expect(received.at(-1)!.sort).toEqual([{ queryField: 'row_product', direction: 'desc' }]);
    first.stream!.setQuerySearch(first.table.data.main, { fields: ['product'], query: '产品24' }); await flush();
    expect(first.snapshots.get(first.table.data.main)).toMatchObject({ status: 'ready', totalCount: 1 });
    expect(second.stream!.getQueryView(second.table.data.main)!.search).toBeUndefined();
    first.stream!.setQueryPageSize(first.table.data.main, 20); await flush();
    expect(received.at(-1)!.pagination).toEqual({ offset: 0, limit: 20 }); controller.dispose();
  });
  it('cancels folded instances, discards ignored-abort late responses and starts afresh', async () => {
    const { page, table, rows } = fixture(); const pending: Array<{ query: EffectiveQuery; signal?: AbortSignal; finish: (value: ReturnType<typeof result>) => void }> = [];
    const controller = createRowExpansionController(page, table, { fetchData(query, _context, signal) { return new Promise(finish => pending.push({ query, signal, finish })); } }, new Map(), new Map(), () => {});
    controller.toggle(rows[0]!); await flush(); const old = controller.get(rows[0]!)!;
    controller.toggle(rows[0]!); expect(pending[0]!.signal!.aborted).toBe(true);
    controller.toggle(rows[0]!); await flush();
    pending[0]!.finish(result(pending[0]!.query)); await flush();
    expect(controller.get(rows[0]!)).not.toBe(old);
    expect(controller.get(rows[0]!)!.snapshots.get(old.table.data.main)?.status).toBe('loading');
    pending[1]!.finish(result(pending[1]!.query)); await flush();
    expect(controller.get(rows[0]!)!.stream!.getQueryView(old.table.data.main)!.pageIndex).toBe(0); controller.dispose();
  });
  it('fails closed on missing bindings and duplicate child keys; retry retains its target window', async () => {
    const { page, table, rows } = fixture(); let calls = 0, fail = false;
    const controller = createRowExpansionController(page, table, { async fetchData(query) { calls++; if (fail) throw Error('temporary'); return result(query); } }, new Map(), new Map(), () => {});
    // Valid instance identity with a missing bound input must not query.
    const binding = table.props.rowExpansion!.data;
    if (binding.type !== 'query') throw Error('fixture');
    binding.bindings['customer-default'] = { source: 'row', field: 'customer-name' };
    controller.toggle({ 'customer-id': 'missing', 'customer-name': null }); await flush();
    expect(calls).toBe(0);
    expect(controller.get({ 'customer-id': 'missing' })!.snapshots.get('orders-default')?.status).toBe('error');
    controller.clear(); binding.bindings['customer-default'] = { source: 'row', field: 'customer-id' };
    controller.toggle(rows[0]!); await flush(); const instance = controller.get(rows[0]!)!;
    fail = true; instance.stream!.setQueryPage(instance.table.data.main, 1); await flush();
    expect(instance.snapshots.get(instance.table.data.main)?.status).toBe('error');
    fail = false; controller.retry(rows[0]!); await flush();
    expect(instance.stream!.getQueryView(instance.table.data.main)!.pageIndex).toBe(1);
    expect(instance.snapshots.get(instance.table.data.main)?.status).toBe('ready'); controller.dispose();
    const nested = fixture('inline'); const duplicate = structuredClone(nested.rows[0]!); const items = duplicate.orders;
    if (!Array.isArray(items)) throw Error('fixture'); items[1]!['order-id'] = items[0]!['order-id'];
    const local = createRowExpansionController(nested.page, nested.table, { async fetchData() { throw Error('unexpected'); } }, new Map(), new Map(), () => {});
    local.toggle(duplicate); expect(local.get(duplicate)!.snapshots.get(local.get(duplicate)!.table.data.main)?.status).toBe('error'); local.dispose();
  });
  it('bounds concurrent scopes and removes a folded request from the queue', async () => {
    const { page, table } = fixture();
    const pending: Array<{ query: EffectiveQuery; finish: (value: ReturnType<typeof result>) => void }> = [];
    const controller = createRowExpansionController(page, table, { fetchData(query) { return new Promise(finish => pending.push({ query, finish })); } }, new Map(), new Map(), () => {});
    const parents = Array.from({ length: 6 }, (_, i) => ({ 'customer-id': `C${i}` }));
    for (const parent of parents) controller.toggle(parent);
    await flush(); expect(pending).toHaveLength(4);
    controller.toggle(parents[4]!); // This queued request must never reach the gateway.
    pending[0]!.finish(result(pending[0]!.query)); await flush();
    expect(pending).toHaveLength(5);
    expect(pending[4]!.query.filterValues).toContainEqual({ target: 'dimension', queryField: 'row_customer', values: ['C5'] });
    controller.dispose(); for (const request of pending) request.finish(result(request.query)); await flush();
  });

});
