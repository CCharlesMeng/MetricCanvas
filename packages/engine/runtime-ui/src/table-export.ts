import type { EffectiveQuery, Page, TableComponent } from '@metriccanvas/page/internal';
import { resolveDataSourceFields } from '@metriccanvas/page/internal';
import type { RuntimeDataGateway } from '../../runtime/src';
import { prepareExportSnapshots, ExportViewError, EXPORT_MAX_ROWS, EXPORT_PREPARATION_TIMEOUT_MS } from '../../runtime/src/export-snapshots';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { exportComponentData, type ExportRenderState } from './export-render-state';

/** Freeze upstream inputs before any await. Fetch only this table's transitive dependency closure. */
export async function prepareTableExport(input: {
  page: Page; component: TableComponent; queries: ReadonlyMap<string, EffectiveQuery>;
  gateway: RuntimeDataGateway; state: Pick<ExportRenderState, 'filters' | 'tables' | 'headerFilters' | 'currentYear' | 'filterRevision' | 'displaySnapshot'>;
  controller: AbortController; views?: ReadonlyMap<string, import('@metriccanvas/page/internal').TableQueryView>; program?: import('@metriccanvas/data-execution/runtime').SourceProgram;
}): Promise<NamedDataSlots> {
  const page = JSON.parse(JSON.stringify(input.page)) as Page;
  const component = JSON.parse(JSON.stringify(input.component)) as TableComponent;
  page.sections = [{ id: 'table-export', components: [component] }];
  const queries = structuredClone(new Map(input.queries));
  const state = { ...input.state, filters: structuredClone(new Map(input.state.filters)), tables: JSON.parse(JSON.stringify(input.state.tables)), headerFilters: JSON.parse(JSON.stringify(input.state.headerFilters)) };
  const { signal } = input.controller;
  const timer = setTimeout(() => input.controller.abort(new ExportViewError('EXPORT_TIMEOUT', '导出准备超过 60 秒')), EXPORT_PREPARATION_TIMEOUT_MS);
  try {
    const snapshots = await abortable(prepareExportSnapshots(page, input.gateway, queries, state.filters, signal, undefined, state.currentYear, Object.values(component.data), input.views && structuredClone(new Map(input.views)), input.program), signal);
    signal.throwIfAborted();
    return exportComponentData({ ...state, page, snapshots, summaries: {} }, component);
  } finally { clearTimeout(timer); }
}

/** Complete detail snapshots are already bound to the clicked row's query scope. */
export function detailExportData(page: Page, component: TableComponent, snapshots: ReadonlyMap<string, import('@metriccanvas/page/internal').DataSnapshot>): NamedDataSlots {
  return Object.fromEntries(Object.entries(component.data).map(([slot, id]) => {
    const snapshot = snapshots.get(id);
    const count = snapshot?.status === 'ready' ? snapshot.rows.length : 0;
    if (!snapshot || (snapshot.status !== 'ready' && snapshot.status !== 'empty') || (snapshot.totalCount !== undefined && snapshot.totalCount !== count)) throw new ExportViewError('EXPORT_INCOMPLETE_DATA', '详情表格缺少完整结果');
    const source = page.dataSources[id];
    if (count > EXPORT_MAX_ROWS) throw new ExportViewError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
    if (source?.source.type === 'query' && snapshot.totalCount === undefined && source.source.resultScope !== 'complete') throw new ExportViewError('EXPORT_INCOMPLETE_DATA', '详情表格缺少完整性证明');
    return [slot, { fields: resolveDataSourceFields(source), snapshot: { status: 'ready', rows: snapshot.status === 'ready' ? snapshot.rows : [] } }];
  }));
}

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}
