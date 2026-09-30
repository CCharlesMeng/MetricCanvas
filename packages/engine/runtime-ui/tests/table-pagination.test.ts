import { expect, it } from 'vitest';
import type { TableComponent } from '@metriccanvas/page/internal';
import { tablePagination } from '../src/table-pagination';

const table: TableComponent = { id: 't', type: 'table', layout: { span: 12 }, data: { main: 'rows' }, props: { columns: [{ field: 'n' }] } };
it('makes every row reachable for an unpaged 714-row table', () => {
  const rows = Array.from({ length: 714 }, (_, n) => ({ n }));
  expect(tablePagination(table, { status: 'ready', rows, totalCount: 714 })).toEqual({ mode: 'local', pageSize: 10, numbered: true });
  expect(tablePagination(table, { status: 'ready', rows: rows.slice(0, 20), totalCount: 714 })).toBeUndefined();
  expect(tablePagination({ ...table, props: { ...table.props, pagination: { mode: 'none' } } }, { status: 'ready', rows })).toEqual({ mode: 'none' });
});

it('paginates eleven rows by default and retains explicit page sizes', () => {
  const rows = Array.from({ length: 11 }, (_, n) => ({ n }));
  expect(tablePagination(table, { status: 'ready', rows })).toEqual({ mode: 'local', pageSize: 10, numbered: true });
  expect(tablePagination(table, { status: 'ready', rows: rows.slice(0, 10) })).toBeUndefined();
  const explicit = { ...table, props: { ...table.props, pagination: { mode: 'local' as const, pageSize: 50 } } };
  expect(tablePagination(explicit, { status: 'ready', rows })).toEqual({ mode: 'local', pageSize: 50 });
});
