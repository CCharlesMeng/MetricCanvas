import { expect, it } from 'vitest';
import document from '../../../pages/capabilities/table/paged-join-search.json';
import { parsePage } from '../src';
import { reconcilePagedJoinView, type PagedJoinDataSource, type TableQueryView } from '../src/internal';

const source = document.dataSources['contract-closure-joined'] as PagedJoinDataSource;
const initial: TableQueryView = { pageIndex: 2, pageSize: 10, sort: [{ field: 'eflow-create-time', direction: 'desc' }], predicates: [] };
it('keeps existing legal search declarations without adding JSON fields or requiring a new version', () => {
  expect(parsePage(document).ok).toBe(true);
  expect(parsePage({ ...document, schemaVersion: '6.112' }).ok).toBe(true);
});
it('switches to search owner, pauses other-member operations and restores defaults on clear', () => {
  const searching = reconcilePagedJoinView(source, { ...initial, pageIndex: 0, search: { fields: ['contract-code'], query: '0012' }, predicates: [{ field: 'owner-name', op: 'in', values: ['仿真责任人'] }] });
  expect(searching).toMatchObject({ sort: [], predicates: [], pageIndex: 0 });
  expect(() => reconcilePagedJoinView(source, { ...searching, sort: initial.sort }, 'eflow-create-time')).toThrow('搜索期间');
  const cleared = reconcilePagedJoinView(source, { ...searching, search: { fields: ['contract-code'], query: '' } }, undefined, searching);
  expect(cleared).toMatchObject({ sort: initial.sort, pageIndex: 0, predicates: [] });
});
it('rejects search fields spanning multiple members and unavailable search owners', () => {
  expect(() => reconcilePagedJoinView(source, { ...initial, search: { fields: ['contract-code', 'owner-name'], query: 'x' } })).toThrow('同一个查询源');
  const unavailable = structuredClone(source); unavailable.source.members.main.canSelectPage = false;
  expect(() => reconcilePagedJoinView(unavailable, { ...initial, search: { fields: ['contract-code'], query: 'x' } })).toThrow('后端分页');
});
