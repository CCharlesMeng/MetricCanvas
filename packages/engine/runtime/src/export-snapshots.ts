import { resolveQueryResultInputs } from './query-result-inputs';
import { queryResultDependencies, cascadeSourceIds, isBoundedResultSource, computeDependencies, flattenPageComponents, declaredPaginationLimit, type Page, type DataSource, type DataSnapshot, type EffectiveQuery } from '@metriccanvas/page/internal';
import { computedSnapshots } from './compute/snapshots';
import type { DataGateway, QueryDiagnosticContext } from './ports';
import type { FilterValues } from './filter-state';

export const EXPORT_MAX_ROWS = 10_000;
export const EXPORT_PREPARATION_TIMEOUT_MS = 60_000;
export class ExportViewError extends Error {
  constructor(public readonly code: 'EXPORT_NOT_READY' | 'EXPORT_BUSY' | 'EXPORT_ROW_LIMIT' | 'EXPORT_TIMEOUT' | 'EXPORT_INCOMPLETE_DATA' | 'EXPORT_RENDER_FAILED' | 'EXPORT_CANCELLED', message: string) {
    super(message); this.name = 'ExportViewError';
  }
}
/** No initial snapshots or overlays. Fetch the captured query scope through the same gateway. */
export async function prepareExportSnapshots(page: Page, gateway: DataGateway, queries: ReadonlyMap<string, EffectiveQuery>, filters: FilterValues, signal: AbortSignal, diagnosticBase?: QueryDiagnosticContext,currentYear=new Date().getFullYear()): Promise<Map<string, DataSnapshot>> {
  const ids = new Set<string>();
  for (const component of flattenPageComponents({ sections: page.sections })) {
    for (const id of Object.values(component.data ?? {})) ids.add(id);
    if (component.type === 'aiSummary') for (const related of Object.values(component.props.relatedData)) ids.add(related.source);
  }
  for (const id of ids) for (const dependency of [...computeDependencies(page.dataSources[id]?.compute ?? []), ...queryResultDependencies(page.dataSources[id])]) ids.add(dependency);
  const sources = new Map<string, DataSource>();
  const raw = new Map<string, DataSnapshot>();
  for (const id of ids) {
    const source = page.dataSources[id];
    if (!source) throw new ExportViewError('EXPORT_INCOMPLETE_DATA', '导出数据源不存在');
    sources.set(id, source);
  }
  const cascaded = cascadeSourceIds(page.dataSources);
  const pending = new Set(ids);
  async function fetchSource(id: string): Promise<void> {
    signal.throwIfAborted();
    const source = sources.get(id)!;
    if (source.source.type === 'inline') {
      const rows = structuredClone(source.source.rows);
      raw.set(id, rows.length ? {status:'ready', rows, totalCount:rows.length} : {status:'empty', totalCount:0});
      return;
    }
    const query = queries.get(id);
    if (!query) throw new ExportViewError('EXPORT_NOT_READY', '缺少导出查询状态');
    const resolved = resolveQueryResultInputs(source, raw, sources);
    if (resolved.status === 'waiting') throw new ExportViewError('EXPORT_NOT_READY', '导出查询输入未就绪');
    if (resolved.status === 'terminal') { raw.set(id, resolved.snapshot); return; }
    const frozen = structuredClone(query);
    const targets = new Set((source.source.query.resultBindings ?? []).map(binding => binding.queryField));
    frozen.filterValues = frozen.filterValues.filter(value => value.target !== 'dimension' || !targets.has(value.queryField));
    frozen.filterValues.push(...resolved.values);
    const diagnostics = {...diagnosticBase, pageId:page.id, dataSourceIds:[id]};
    if (cascaded.has(id)) {
      const result = await gateway.fetchData(frozen, diagnostics, signal);
      signal.throwIfAborted();
      const limit = declaredPaginationLimit(source.source.query);
      if (result.rows.length > EXPORT_MAX_ROWS ||
          (isBoundedResultSource(page.dataSources, id) && limit !== undefined && result.rows.length > limit) ||
          (result.totalCount !== undefined && (!Number.isSafeInteger(result.totalCount) || result.totalCount < result.rows.length))) {
        throw new ExportViewError('EXPORT_INCOMPLETE_DATA', '导出结果不符合声明范围');
      }
      const total = result.totalCount === undefined ? {} : {totalCount:result.totalCount};
      raw.set(id, result.rows.length ? {status:'ready', rows:result.rows, ...total} : {status:'empty', ...total});
    } else {
      const rows = await fetchComplete(frozen, gateway, signal, diagnostics, source.source.resultScope === 'complete');
      if (rows.length > EXPORT_MAX_ROWS) throw new ExportViewError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
      raw.set(id, rows.length ? {status:'ready', rows, totalCount:rows.length} : {status:'empty',totalCount:0});
    }
  }
  while (pending.size) {
    signal.throwIfAborted();
    const ready = [...pending].filter(id => queryResultDependencies(sources.get(id)).every(dependency => raw.has(dependency)));
    if (!ready.length) throw new ExportViewError('EXPORT_INCOMPLETE_DATA', '导出查询依赖未满足');
    for (let index = 0; index < ready.length; index += 5) await Promise.all(ready.slice(index,index + 5).map(fetchSource));
    ready.forEach(id => pending.delete(id));
  }
  const snapshots = computedSnapshots(sources,raw,{
    currentYear,
    modes:new Map([...filters].flatMap(([id,value])=>value.type==='dimension'?[[id,value.values] as const]:[])),
    ranges:new Map([...filters].flatMap(([id,value])=>value.type==='timeRange'?[[id,{from:value.from,to:value.to}] as const]:[]))
  });
  for(const value of snapshots.values()) {
    if(value.status==='loading'||value.status==='error') throw new ExportViewError('EXPORT_INCOMPLETE_DATA','导出查询或数据计算未完成');
    if(value.status==='ready'&&value.rows.length>EXPORT_MAX_ROWS) throw new ExportViewError('EXPORT_ROW_LIMIT','导出单表超过 10000 行');
  }
  return snapshots;
}
async function fetchComplete(query: EffectiveQuery | undefined,gateway:DataGateway,signal:AbortSignal,diagnostics:QueryDiagnosticContext,trustedComplete=false) {
  if(!query) throw new ExportViewError('EXPORT_NOT_READY','缺少导出查询状态');
  const frozen=structuredClone(query);
  const declared=frozen.pagination?.limit??declaredPaginationLimit({language:frozen.language,body:frozen.body});
  const limit=Math.min(declared??500,500);
  let paged=declared!==undefined;
  let offset=0;
  let expected:number|undefined;
  const rows:import('@metriccanvas/page/internal').Row[]=[];
  while(true) {
    signal.throwIfAborted();
    const request={...frozen,...(paged?{pagination:{offset,limit}}:{})};
    const result=await gateway.fetchData(request,diagnostics,signal);
    signal.throwIfAborted();
    if (result.totalCount !== undefined && (!Number.isSafeInteger(result.totalCount) || result.totalCount < 0)) throw new ExportViewError('EXPORT_INCOMPLETE_DATA','导出结果总数不合法');
    if(result.totalCount!==undefined&&result.totalCount>EXPORT_MAX_ROWS) throw new ExportViewError('EXPORT_ROW_LIMIT','导出单表超过 10000 行');
    if(expected!==undefined&&result.totalCount!==expected) throw new ExportViewError('EXPORT_INCOMPLETE_DATA','导出分页期间结果总数发生变化');
    expected??=result.totalCount;
    if(!paged && expected!==undefined && expected>result.rows.length) { paged=true; continue; }
    if(paged && expected===undefined) throw new ExportViewError('EXPORT_INCOMPLETE_DATA','完整导出分页需要 totalCount');
    if(result.rows.length>limit&&paged) throw new ExportViewError('EXPORT_INCOMPLETE_DATA','导出分页返回行数超出请求范围');
    rows.push(...result.rows);
    if(rows.length>EXPORT_MAX_ROWS) throw new ExportViewError('EXPORT_ROW_LIMIT','导出单表超过 10000 行');
    if(expected!==undefined&&rows.length>expected) throw new ExportViewError('EXPORT_INCOMPLETE_DATA','导出行数超出结果总数');
    if(!paged && expected===undefined && !trustedComplete)throw new ExportViewError('EXPORT_INCOMPLETE_DATA','完整导出需要 totalCount 或显式完整结果契约');
    if(!paged || rows.length===expected) return rows;
    if(!result.rows.length) throw new ExportViewError('EXPORT_INCOMPLETE_DATA','导出分页提前结束');
    offset=rows.length;
  }
}
