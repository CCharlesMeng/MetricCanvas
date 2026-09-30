import { describe, expect, it } from 'vitest';
import type { Row } from '@metriccanvas/page/internal';
import { applySearchFilters } from '../src/filters/inline-search';
import type { Page } from '@metriccanvas/page';
import type { FilterValues } from '../../runtime/src';
import type { TableViewState } from '../../widgets/src/components/table/view-state';
import { resetFilteredTablePages, sortTableRows } from '../src/table-state';

const view: TableViewState = {
  pageIndex: 2, sort: [{ field: 'amount', direction: 'desc' }],
  headerFilters: { name: { mode: 'select', values: ['A'] } }
};
const page: Page = {
  schemaVersion: '6.11', id: 'table-state',
  filters: [{ id: 'search', type: 'search', label: '搜索' }],
  dataSources: { customers: { fields: { name: { type: 'string', role: 'dimension' } }, source: { type: 'inline', rows: [] } } },
  sections: [{ id: 'body', components: [{
    id: 'tabs', type: 'tabContainer', layout: { span: 12 }, props: { tabs: ['A', 'B'].map(id => ({
      id, label: id, components: [{ id: `table-${id}`, type: 'table' as const, layout: { span: 12 }, data: { main: 'customers' },
        props: { columns: [{ field: 'name' }], pagination: { mode: 'local' as const, pageSize: 10 } } }]
    })) }
  }] }]
};

describe('IOC F4/F7 表格状态', () => {
  it('全页搜索复位所有 Tab 下的本地页码，同时保留排序和列头筛选', () => {
    const before = { 'table-A': view, 'table-B': { ...view, pageIndex: 1 } };
    const next: FilterValues = new Map([['search', { type: 'search', query: '第21行' }]]);
    const result = resetFilteredTablePages(page, before, new Map(), next);
    expect(result['table-A']).toEqual({ ...view, pageIndex: 0 });
    expect(result['table-B']).toEqual({ ...view, pageIndex: 0 });
    expect(before['table-A'].pageIndex).toBe(2);
    expect(resetFilteredTablePages(page, before, next, next)).toBe(before);
  });

  it('第21行的唯一搜索命中先于本地排序与分页', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ name: `客户${index + 1}`, amount: index + 1 }));
    const filters: FilterValues = new Map([['search', { type: 'search', query: '客户21' }]]);
    const state = resetFilteredTablePages(page, { 'table-A': view }, new Map(), filters)['table-A'];
    const searched = applySearchFilters(rows, filters, page.dataSources.customers.fields);
    expect(sortTableRows(searched, state.sort).slice(state.pageIndex * 10, state.pageIndex * 10 + 10))
      .toEqual([{ name: '客户21', amount: 21 }]);
  });

  it('原始数值排序，null/缺字段/非有限值在双向排序下均排尾且稳定', () => {
    const rows: Row[] = [{ id: 'a', amount: 80 }, { id: 'b', amount: null }, { id: 'c', amount: 1000 },
      { id: 'd' }, { id: 'e', amount: 9 }, { id: 'f', amount: Infinity }];
    expect(sortTableRows(rows, [{ field: 'amount', direction: 'asc' }]).map(r => r.id))
      .toEqual(['e', 'a', 'c', 'b', 'd', 'f']);
    expect(sortTableRows(rows, [{ field: 'amount', direction: 'desc' }]).map(r => r.id))
      .toEqual(['c', 'a', 'e', 'b', 'd', 'f']);
    expect(rows[0].id).toBe('a');
  });
});
