import { unionCandidates } from '../paged-union/candidates';
import {isPagedJoinQuery} from '@metriccanvas/page/internal';
import {queryJoinCandidates} from '../paged-join/candidates';
import { candidateQueryRunner } from './candidate-priority';
import { createCandidateValidator } from '../candidate-validation';
import { selectQuerySource, canonicalizeJson, type DisplayInputsSnapshot } from '@metriccanvas/page/internal';
import type { RuntimeDataGateway } from '../ports';
import { compilePagedJoin } from '../paged-join/plan';
import { executePagedJoin } from '../paged-join/execute';
import { hasQueryFieldMapping, tableHeaders, type Page, type TableQueryView, type DataSnapshot, type EffectiveQuery, type QueryDataSource, type PagedJoinDataSource } from '@metriccanvas/page/internal';
import type { ColumnCandidatesPage } from '../ports';
import type { FilterValues } from '../filter-values';
import type { QueryRunner } from '../query-runner';
import type { SourceRead, SourceUpdate } from './session';
import { candidateView, localColumnCandidates } from '../column-candidates';
import { composeEffectiveQuery, bindQueryResultValues } from '../effective-query';
import { resolveQueryResultInputs } from '../query-result-inputs';

function appliedInputSources(page:Page,source:QueryDataSource,conditions:FilterValues) {
  const sources=new Map(Object.entries(page.dataSources));
  for(const binding of source.source.query.resultBindings??[]){
    const upstream=sources.get(binding.source);
    if(upstream?.source.type==='query')sources.set(binding.source,selectQuerySource(upstream as QueryDataSource,conditions));
  }
  return sources;
}

export interface ColumnCandidatesRead {
  /** Idle speculative work; ordinary reads and explicit menu requests take precedence. */
  preload?: boolean;
  displayInputs?: DisplayInputsSnapshot; filterRevision?: number; now?: Date;
  sourceId: string; field: string; conditions: FilterValues; view: TableQueryView;
  views?: ReadonlyMap<string, TableQueryView>; seeds?: ReadonlyMap<string, DataSnapshot>;
  candidateSearch?: string; offset?: number; pageSize?: number; currentYear?: number; signal?: AbortSignal;
}
type Read = (request: SourceRead) => AsyncGenerator<SourceUpdate>;
type CandidateContext={gateway:RuntimeDataGateway;displayInputs?:()=>DisplayInputsSnapshot|undefined;filterRevision?:()=>number;now?:Date;clock?:()=>Date};

function freezeCandidateRequest(input:ColumnCandidatesRead,context:CandidateContext):ColumnCandidatesRead{
  return structuredClone({...input,signal:undefined,now:input.now??context.now??context.clock?.()??new Date(),
    displayInputs:input.displayInputs??context.displayInputs?.(),filterRevision:input.filterRevision??context.filterRevision?.()});
}
function candidateSource(page:Page,request:ColumnCandidatesRead){
  const offset=request.offset??0,limit=request.pageSize??50;
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('候选分页范围不合法');
  const source=page.dataSources[request.sourceId],field=source?.fields[request.field];
  if(!source||!field||field.role!=='dimension'||!['string','number','date','datetime'].includes(field.type))return undefined;
  return source;
}
function pageSearchRows(rows: readonly import('@metriccanvas/page/internal').Row[], conditions: FilterValues, fields: Page['dataSources'][string]['fields']) {
  const terms = [...conditions.values()].filter(value => value.type === 'search').map(value => value.query.trim().toLowerCase()).filter(Boolean);
  const textFields = Object.entries(fields).filter(([, field]) => field.type === 'string').map(([id]) => id);
  return rows.filter(row => terms.every(term => textFields.some(id => String(row[id] ?? '').toLowerCase().includes(term))));
}
/** Complete local results and verified remote DISTINCT share one source-owned read interface. */
export function createColumnCandidatesReader(page: Page, runner: QueryRunner, read: Read, limits: ReadonlyMap<string, number>, context: CandidateContext) {
  return async (input: ColumnCandidatesRead): Promise<ColumnCandidatesPage> => {
    const request = freezeCandidateRequest(input,context);
    const signal = input.signal;
    const execution = candidateQueryRunner(runner, request.preload);
    signal?.throwIfAborted();
    const source = candidateSource(page,request);
    if(!source)return {kind:'unavailable'};
    const validation = createCandidateValidator(page, context.gateway, { now: request.now, displayInputs: () => request.displayInputs, filterRevision: () => request.filterRevision ?? 0 });
    if (validation.requires(request.sourceId)) await validation.verify(request.sourceId, request.conditions, signal ?? new AbortController().signal);
    signal?.throwIfAborted();
    const scope = request.displayInputs ? `context:${canonicalizeJson([request.displayInputs, request.filterRevision ?? null])}` : 'session';
    const view = candidateView(request.view, request.field);
    const views = new Map(request.views); views.set(request.sourceId, view);
    if (source.source.type === 'query' && source.source.resultScope !== 'complete') return ordinaryCandidates(page,source as QueryDataSource,request,view,limits,execution,scope,signal);
    if (source.source.type === 'pagedUnion') return unionCandidates(page, request, execution, scope, signal);
    if (source.source.type === 'pagedJoin') return isPagedJoinQuery(source.source)?queryJoinCandidates(page,source as PagedJoinDataSource,request,execution,scope,signal):joinedCandidates(page, request, view, execution, scope, signal);
    return localCandidates(page,request,view,views,read,signal);
  };
}

async function joinedCandidates(page: Page, request: ColumnCandidatesRead, view: TableQueryView, runner: QueryRunner, scope: string, signal?: AbortSignal): Promise<ColumnCandidatesPage> {
      const plan = compilePagedJoin(page, request.sourceId, request.conditions, view, request.now);
      const result = await executePagedJoin({ ...plan, selection: undefined, strategy: 'completeJoin' }, runner, scope, signal, true);
      const snapshot = result.snapshot;
      if (snapshot.status !== 'ready' && snapshot.status !== 'empty') return { kind: 'unavailable' };
      const rows = snapshot.status === 'ready' ? snapshot.rows : [];
      if (snapshot.totalCount !== rows.length) return { kind: 'unavailable' };
      return localColumnCandidates(pageSearchRows(rows, request.conditions, page.dataSources[request.sourceId].fields), request.field, view, request.candidateSearch ?? '', request.offset ?? 0, request.pageSize ?? 50);
 }

async function ordinaryCandidates(page:Page,source:QueryDataSource,request:ColumnCandidatesRead,view:TableQueryView,limits:ReadonlyMap<string,number>,runner:QueryRunner,scope:string,signal?:AbortSignal):Promise<ColumnCandidatesPage>{
      const views=new Map(request.views);views.set(request.sourceId,view);
      const offset=request.offset??0,limit=request.pageSize??50;
      const query: EffectiveQuery = composeEffectiveQuery({ now: request.now, filters: page.filters, dataSource: source as QueryDataSource }, request.conditions, 0, [], tableHeaders(view.predicates), view.search);
      const mappedField=query.fieldMappings[request.field];
      if (!hasQueryFieldMapping(mappedField)) return { kind: 'unavailable' };
      const windows = new Map(limits);
      for (const [id, current] of views) if (windows.has(id)) windows.set(id, current.pageSize);
      const inputs = resolveQueryResultInputs(source, new Map(request.seeds), appliedInputSources(page,source as QueryDataSource,request.conditions), windows);
      if (inputs.status === 'waiting') return { kind: 'unavailable' };
      if (inputs.status === 'terminal') {
        if (inputs.snapshot.status === 'empty') return { kind: 'values', candidates: [], totalCount: 0 };
        throw Object.assign(new Error('候选查询的业务输入不可用'), { code: 'DQE_QUERY_REJECTED' });
      }
      bindQueryResultValues(query, inputs.values);
      return runner.runCandidates({ query, field: request.field, queryField: mappedField.queryField, search: request.candidateSearch ?? '', offset, limit },
        { pageId: page.id, dataSourceIds: [request.sourceId] }, scope, signal);
}

async function localCandidates(page:Page,request:ColumnCandidatesRead,view:TableQueryView,views:Map<string,TableQueryView>,read:Read,signal?:AbortSignal):Promise<ColumnCandidatesPage>{
 const source=page.dataSources[request.sourceId],offset=request.offset??0,limit=request.pageSize??50;
    // Preserve upstream declared windows. Only the target local view loses table predicates.
    views.set(request.sourceId, { ...view, predicates: [], search: undefined });
    const seeds = new Map(request.seeds); seeds.delete(request.sourceId);
    // Compute dependencies must retain their own captured snapshots and windows.
    let final: DataSnapshot | undefined, evidence: DataSnapshot | undefined;
    for await (const update of read({ roots: [request.sourceId], conditions: request.conditions, views, seeds, currentYear: request.currentYear, now: request.now, displayInputs: request.displayInputs, filterRevision: request.filterRevision, signal, background: request.preload })) {
      if (update.sourceId === request.sourceId) { final = update.snapshot; evidence = update.raw; }
    }
    signal?.throwIfAborted();
    if (!final || final.status === 'loading') return { kind: 'unavailable' };
    if (final.status === 'error') throw Object.assign(new Error(final.error.message), { code: final.error.code });
    const rows = final.status === 'ready' ? final.rows : [];
    const rawRows = evidence?.status === 'ready' ? evidence.rows.length : 0;
    if (evidence && 'totalCount' in evidence && evidence.totalCount !== undefined && evidence.totalCount !== rawRows) return { kind: 'unavailable' };
    return localColumnCandidates(pageSearchRows(rows, request.conditions, source.fields), request.field, view, request.candidateSearch ?? '', offset, limit);
}
