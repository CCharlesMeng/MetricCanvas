import type {TableRenderBinding} from './component-render';
import {buildTableColumnLayout} from '../../widgets/src/components/table/columns';
import type {DimensionValuesSnapshots} from '../../runtime/src/dimension-values';
import { conditionSourceIds, hasQueryFieldMapping, fieldName, tableHeaders, type Page, type TableHeaderFilters, type TableQueryView, type TableComponent } from '@metriccanvas/page/internal';
import { evaluateTableView, defaultSourceView } from '@metriccanvas/data-execution/runtime';
import { createTableSession, type TableSession } from '../../runtime/src/table-session';
import type { PageSnapshotStream, FilterValues } from '../../runtime/src';
import { shouldApplyTableHeaderFilter, type TableHeaderFilterValue, type TableViewState } from '../../widgets/src/components/table/view-state';

export function normalizeHeaderDraft(value: TableHeaderFilterValue): TableHeaderFilters[string] | undefined {
  if (!shouldApplyTableHeaderFilter(value)) return undefined;
  if (value.mode !== 'numberRange') return value;
  const from = value.from.trim() ? Number(value.from) : undefined, to = value.to.trim() ? Number(value.to) : undefined;
  return { mode: 'numberRange', ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) };
}
function renderHeaders(headers: TableHeaderFilters): Record<string, TableHeaderFilterValue> {
  return Object.fromEntries(Object.entries(headers).map(([field, value]) => [field, value.mode === 'numberRange'
    ? { mode: 'numberRange', from: value.from === undefined ? '' : String(value.from), to: value.to === undefined ? '' : String(value.to) }
    : value.mode === 'select' ? { ...value, values: [...value.values] } : value]));
}
/** Draft ownership and event adaptation; committed values live exclusively in TableSession. */
export function createTableController(page: Page, stream: () => PageSnapshotStream | null, changed: () => void) {
  const sessions = new Map<string, TableSession>();
  const headers = new Map<string, Record<string, TableHeaderFilterValue>>();
  const searches = new Map<string, string>();
  const remote = (table: TableComponent) => table.props.pagination?.mode === 'query' || stream()?.getQueryPageSize(table.data.main) !== undefined;
  function local(table: TableComponent) {
    let session = sessions.get(table.id);
    if (!session) { session = createTableSession(defaultSourceView(page, table.data.main, table.props.pagination?.mode === 'local' ? table.props.pagination.pageSize : 20), changed); sessions.set(table.id, session); }
    return session;
  }
  function view(table: TableComponent): TableQueryView { return remote(table) ? stream()?.getQueryView(table.data.main) ?? defaultSourceView(page, table.data.main) : local(table).snapshot(); }
  const controller = {
    view,
    candidateDimensions(table:TableComponent):Record<string,string> {
      const source=page.dataSources[table.data.main];
      return Object.fromEntries(buildTableColumnLayout(table.props.columns).leaves.filter(c=>c.filterable?.mode==='select').flatMap(c=>{
        const field=fieldName(c.field),projection=source?.source.type==='pagedJoin'?source.source.projection[field]:undefined;
        const definition=projection&&source.source.type==='pagedJoin'?page.dataSources[source.source.members[projection.member].source]?.fields[projection.field]:source?.fields[field];
        return definition&&hasQueryFieldMapping(definition)?[[field,definition.queryField]]:[];
      }));
    },
    candidateStates(table:TableComponent,states:DimensionValuesSnapshots){return Object.fromEntries(Object.entries(controller.candidateDimensions(table)).map(([field,dimension])=>[field,states.get(dimension)?.status??'idle']));},
    binding(table:TableComponent,presentation:Omit<TableRenderBinding,'view'|'searchDraft'|'onsearchdraft'|'onsearch'|'onpage'|'onpagesize'|'onsort'|'onheaderfilter'>):TableRenderBinding {
      const source=page.dataSources[table.data.main];
      return {...presentation,sortReset:source?.source.type==='pagedJoin'?source.source.ordering.default:undefined,view:controller.render(table),searchDraft:controller.searchDraft(table),
        onsearchdraft:query=>controller.setSearchDraft(table,query),onsearch:query=>controller.search(table,query),
        onpage:index=>controller.page(table,index),onpagesize:size=>controller.pageSize(table,size),
        onsort:sort=>controller.sort(table,sort),onheaderfilter:(field,value)=>controller.header(table,field,value)};
    },
    present(table:TableComponent,rows:readonly import('@metriccanvas/page/internal').Row[],complete=false){return evaluateTableView(rows,view(table),complete);},
    render(table: TableComponent): TableViewState {
      const committed = view(table);
      return { pageIndex: committed.pageIndex, sort: committed.sort, searchQuery: committed.search?.query,
        headerFilters: { ...renderHeaders(tableHeaders(committed.predicates)), ...headers.get(table.id) } };
    },
    headers(table: TableComponent) { return tableHeaders(view(table).predicates); },
    searchDraft(table: TableComponent) { return searches.get(table.id) ?? view(table).search?.query ?? ''; },
    setSearchDraft(table: TableComponent, query: string) { searches.set(table.id, query); changed(); },
    search(table: TableComponent, query: string) {
      const fields = table.props.toolbar?.search?.fields; if (!fields) return;
      searches.set(table.id, query);
      const search = { fields: [...fields], query: query.trim() };
      if (remote(table)) stream()?.setQuerySearch(table.data.main, search); else local(table).setSearch(search);
      changed();
    },
    page(table: TableComponent, pageIndex: number) { if (remote(table)) stream()?.setQueryPage(table.data.main, pageIndex); else local(table).setPage(pageIndex); changed(); },
    pageSize(table: TableComponent, pageSize: number) { if (remote(table)) stream()?.setQueryPageSize(table.data.main, pageSize); else local(table).setPageSize(pageSize); changed(); },
    sort(table: TableComponent, sort: TableQueryView['sort']) { if (remote(table)) stream()?.setQuerySort(table.data.main, sort); else local(table).setSort(sort); changed(); },
    header(table: TableComponent, field: string, value: TableHeaderFilterValue | null) {
      const draft = { ...headers.get(table.id) }; if (value === null) delete draft[field]; else draft[field] = value;
      headers.set(table.id, draft); changed();
      if (!shouldApplyTableHeaderFilter(value)) return;
      const applied = { ...controller.headers(table) };
      const normalized = value && normalizeHeaderDraft(value);
      if (!normalized || (normalized.mode === 'numberRange' && normalized.from === undefined && normalized.to === undefined)) delete applied[field]; else applied[field] = normalized;
      if (remote(table)) stream()?.setQueryHeaderFilters(table.data.main, applied); else local(table).setHeaders(applied);
      changed();
    },
    reset(table: TableComponent, previous: FilterValues, next: FilterValues) {
      if (remote(table)) return;
      const changedIds = new Set([...new Set([...previous.keys(), ...next.keys()])].filter(id => JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id))));
      const affected = [...conditionSourceIds(page, table.data.main)].some(id => {
        const source = page.dataSources[id];
        return (source?.source.type === 'query' && Object.keys(source.source.query.filterBindings ?? {}).some(id => changedIds.has(id))) ||
          source?.compute?.some(op => (op.op === 'selectField' && changedIds.has(op.filter)) || (op.op === 'timeFill' && 'filter' in op.range && changedIds.has(op.range.filter)));
      }) || page.filters?.some(f => f.type === 'search' && changedIds.has(f.id));
      if (affected) local(table).resetPage(); changed();
    },
    dispose() { for (const session of sessions.values()) session.dispose(); sessions.clear(); headers.clear(); searches.clear(); }
  };
  return controller;
}
