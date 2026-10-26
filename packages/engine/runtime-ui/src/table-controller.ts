import {fieldSelectionIds, queryFilterIds, canonicalizeJson, conditionSourceIds, tableHeaders, tableSearchOption, tableSearchValue, type Page, type TableHeaderFilters, type TableQueryView, type TableComponent} from '@metriccanvas/page/internal';
import { createColumnCandidatesSession } from '../../runtime/src/column-candidates';
import type {TableRenderBinding} from './component-render';
import { evaluateTableView, defaultSourceView, type ColumnCandidatesRead } from '@metriccanvas/data-execution/runtime';
import { createTableSession, type TableSession } from '../../runtime/src/table-session';
import { remoteTableSearch } from './table-search';
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
export function createTableController(page: Page, stream: () => PageSnapshotStream | null, changed: () => void, conditions: () => FilterValues = () => new Map(), candidateContext: () => Pick<ColumnCandidatesRead, 'now' | 'displayInputs' | 'filterRevision'> = () => ({})) {
  const sessions = new Map<string, TableSession>();
  const candidates = new Map<string, ReturnType<typeof createColumnCandidatesSession>>();
  const headers = new Map<string, Record<string, TableHeaderFilterValue>>();
  const searches = new Map<string, string>();
  const searchOptions = new Map<string, string>();
  const remote = (table: TableComponent) => stream()?.getQueryView(table.data.main) !== undefined &&
    (table.props.pagination?.mode === 'query' || stream()?.getQueryPageSize(table.data.main) !== undefined || remoteTableSearch(page.dataSources[table.data.main]));
  function local(table: TableComponent) {
    let session = sessions.get(table.id);
    if (!session) { session = createTableSession(defaultSourceView(page, table.data.main, table.props.pagination?.mode === 'local' ? table.props.pagination.pageSize : 20), changed); sessions.set(table.id, session); }
    return session;
  }
  function view(table: TableComponent): TableQueryView { return remote(table) ? stream()?.getQueryView(table.data.main) ?? defaultSourceView(page, table.data.main) : local(table).snapshot(); }
  function candidateSession(table: TableComponent) {
    let session = candidates.get(table.id);
    if (!session) {
      session = createColumnCandidatesSession(async (field, search, offset, signal) => {
        const current = stream(), program = current?.getSourceProgram();
        if (!current || !program) return { kind: 'unavailable' };
        return program.readColumnCandidates({ ...candidateContext(), sourceId: table.data.main, field, conditions: conditions(), view: view(table),
          views: current.captureViews(), seeds: current.captureRawSnapshots(), candidateSearch: search, offset, pageSize: 50, currentYear: current.captureComputeYear(), signal });
      }, field => {
        const current = view(table), ids = conditionSourceIds(page, table.data.main), raw = stream()?.captureRawSnapshots();
        const filterIds = new Set([...ids].flatMap(id => {
          const source = page.dataSources[id];
          return [...(source?.source.type === 'query' ? queryFilterIds(source.source.query) : []),
            ...(source?.compute ?? []).flatMap(op => op.op === 'selectField' ? [op.filter] : op.op === 'timeFill' && 'filter' in op.range ? [op.range.filter] : [])];
        }));
        const inputs = [...conditions()].filter(([id, value]) => filterIds.has(id) || value.type === 'search')
          .map(([id, value]) => [id, value.type === 'timeRange' ? { type: value.type, from: value.from, to: value.to } : value]);
        return canonicalizeJson({ context: candidateContext(), conditions: inputs, predicates: current.predicates.filter(p => p.field !== field), search: current.search,
          dependencies: [...ids].filter(id => id !== table.data.main).map(id => [id, raw?.get(id) ?? null]) });
      }, changed);
      candidates.set(table.id, session);
    }
    return session;
  }
  const controller = {
    view,
    syncCandidates() { for (const session of candidates.values()) session.sync(); },
    candidateBinding(table: TableComponent) {
      const session = candidateSession(table);
      return { columnCandidates: session.snapshots(),
        oncandidateopen: (field: string, open: boolean) => open ? session.open(field) : session.close(field),
        oncandidatesearch: (field: string, query: string) => session.search(field, query),
        oncandidatemore: (field: string) => session.more(field), oncandidateretry: (field: string) => session.retry(field) };
    },
    binding(table:TableComponent,presentation:Omit<TableRenderBinding,'view'|'searchDraft'|'searchOption'|'onsearchoption'|'onsearchdraft'|'onsearch'|'onpage'|'onpagesize'|'onsort'|'onheaderfilter'>):TableRenderBinding {
      const source=page.dataSources[table.data.main];
      return {...presentation,failureNotice:source?.source.type==='pagedUnion'?'多来源数据加载失败，请刷新重试。':undefined,sortReset:(source?.source.type === 'pagedJoin' || source?.source.type === 'pagedUnion')?source.source.ordering.default:undefined,view:controller.render(table),searchDraft:controller.searchDraft(table),searchOption:controller.searchOption(table),
        onsearchoption:value=>{if(presentation.toolbarEnabled?.search!==false)controller.selectSearchOption(table,value);},
        onsearchdraft:query=>{if(presentation.toolbarEnabled?.search!==false)controller.setSearchDraft(table,query);},onsearch:query=>{if(presentation.toolbarEnabled?.search!==false)controller.search(table,query);},
        onpage:index=>controller.page(table,index),onpagesize:size=>controller.pageSize(table,size),
        onsort:sort=>controller.sort(table,sort),onheaderfilter:(field,value)=>controller.header(table,field,value)};
    },
    present(table:TableComponent,rows:readonly import('@metriccanvas/page/internal').Row[],complete=false){return evaluateTableView(rows,view(table),complete);},
    render(table: TableComponent): TableViewState {
      const committed = view(table);
      return { pageIndex: committed.pageIndex, sort: committed.sort, searchQuery: committed.search?.query, search: committed.search,
        headerFilters: { ...renderHeaders(tableHeaders(committed.predicates)), ...headers.get(table.id) } };
    },
    headers(table: TableComponent) { return tableHeaders(view(table).predicates); },
    searchDraft(table: TableComponent) { return searches.get(table.id) ?? view(table).search?.query ?? ''; },
    searchOption(table: TableComponent) { return tableSearchOption(table.props.toolbar?.search, searchOptions.get(table.id))?.value; },
    selectSearchOption(table: TableComponent, value: string) {
      const search = table.props.toolbar?.search;
      if (!search || !('options' in search) || !search.options.some(option => option.value === value) || controller.searchOption(table) === value) return;
      searchOptions.set(table.id, value);
      controller.search(table, controller.searchDraft(table));
    },
    setSearchDraft(table: TableComponent, query: string) { searches.set(table.id, query); changed(); },
    search(table: TableComponent, query: string) {
      const search = tableSearchValue(table.props.toolbar?.search, query.trim(), controller.searchOption(table)); if (!search) return;
      searches.set(table.id, query);
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
      const changedIds = new Set([...new Set([...previous.keys(), ...next.keys()])].filter(id => JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id))));
      if(fieldSelectionIds(table.props).some(id=>changedIds.has(id))){headers.delete(table.id);searches.delete(table.id);searchOptions.delete(table.id);if(!remote(table))local(table).resetPresentation();changed();return;}
      if(remote(table))return;
      const affected = [...conditionSourceIds(page, table.data.main)].some(id => {
        const source = page.dataSources[id];
        return (source?.source.type === 'query' && queryFilterIds(source.source.query).some(id => changedIds.has(id))) ||
          source?.compute?.some(op => (op.op === 'selectField' && changedIds.has(op.filter)) || (op.op === 'timeFill' && 'filter' in op.range && changedIds.has(op.range.filter)));
      }) || page.filters?.some(f => f.type === 'search' && changedIds.has(f.id));
      if (affected) local(table).resetPage(); changed();
    },
    dispose() { for (const session of candidates.values()) session.dispose(); candidates.clear(); for (const session of sessions.values()) session.dispose(); sessions.clear(); headers.clear(); searches.clear(); searchOptions.clear(); }
  };
  return controller;
}
