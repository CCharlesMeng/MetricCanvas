import { canonicalizeJson, parsePage, type PageDocument } from '@metriccanvas/page';
import { flattenPageComponents, hasQueryFieldMapping, isQueryErrorCode, matchesParamDeclaration, normalizeQueryRows, type DataSnapshot, type QueryDataSourceFieldDefinition } from '@metriccanvas/page/internal';
import { createFilterState, parseFilterSearch, type FilterValue, type FilterValues } from './filter-state';
import { initializePageParams, type PageParamValues } from './page-params';

/** T04内部消费契约；具体HTTP、鉴权及metadata→精确target解析属于提供方适配器。 */
export type ExecutionTarget =
  | {kind: 'draft'; ref: {pageId: string; revisionId: string; resourceId: string}}
  | {kind: 'candidate'; ref: {candidateId: string; candidateVersion: string; source: {pageId:string;revisionId:string;resourceId:string}}}
  | {kind: 'template'; ref: {templateId: string; templateRevisionId: string; source: {pageId:string;revisionId:string;resourceId:string}}};
export interface ExecutionRequest { target: ExecutionTarget; operationId: string; explicitInputs: Record<string, unknown> }
export interface ExecutionPort { execute(request: ExecutionRequest, signal?: AbortSignal): Promise<unknown> }
export class ExecutionError extends Error {
  constructor(public readonly code: 'RESPONSE_MISMATCH' | 'NO_ACCESS_SCOPE' | 'CAPABILITY_UNAVAILABLE' | 'EXECUTION_REJECTED', message: string) { super(message); this.name = 'ExecutionError'; }
}
export interface ExecutionBootstrap {
  readonly document: PageDocument;
  readonly target: ExecutionTarget;
  readonly operationId: string;
  readonly executionId: string;
  readonly conditionKey: string;
  readonly params: PageParamValues;
  readonly filters: FilterValues;
  readonly snapshots: ReadonlyMap<string, DataSnapshot>;
  readonly sourceKeys: ReadonlyMap<string, string>;
  /** 由可信宿主绑定的最后筛选端口；不来自执行响应/页面文档。 */
  readonly recordFilters?: (values: FilterValues) => void;
}

export async function loadExecution(request: ExecutionRequest, port?: ExecutionPort, signal?: AbortSignal): Promise<ExecutionBootstrap> {
  if (!port) throw new ExecutionError('CAPABILITY_UNAVAILABLE', '执行能力尚未接入');
  signal?.throwIfAborted();
  const expected = structuredClone(request);
  const response = await port.execute(structuredClone(expected), signal);
  signal?.throwIfAborted();
  return prepareExecution(expected, response);
}

/** 校验关联与完整结果后才返回可渲染bootstrap；拒绝结果不能降级成无条件查数。 */
export function prepareExecution(request: ExecutionRequest, response: unknown, recordFilters?: (values: FilterValues) => void): ExecutionBootstrap {
  function fail(message: string): never { throw new ExecutionError('RESPONSE_MISMATCH', message); }
  if (!validTarget(request.target) || !nonempty(request.operationId) || !record(request.explicitInputs)) fail('执行请求缺少精确目标或操作键');
  if (!record(response)) fail('执行响应必须是对象');
  if (response.status === 'rejected') throw new ExecutionError(response.code === 'NO_ACCESS_SCOPE' ? 'NO_ACCESS_SCOPE' : response.code === 'CAPABILITY_UNAVAILABLE' ? 'CAPABILITY_UNAVAILABLE' : 'EXECUTION_REJECTED', '执行被拒绝');
  if (!['success','partial','error'].includes(String(response.status)) || response.operationId !== request.operationId || !record(response.target) || canonicalizeJson(response.target) !== canonicalizeJson(request.target)) fail('执行回执不属于本次精确目标与操作');
  if (!nonempty(response.executionId) || !nonempty(response.conditionKey) || !record(response.appliedInputs) || !record(response.filterValues) || !record(response.dataSources)) fail('执行回执缺少初始化上下文');
  const parsed = parsePage(response.document);
  if (!parsed.ok) fail('执行文档未通过页面校验');
  const page = parsed.page;
  if (page.id !== (request.target.kind === 'draft' ? request.target.ref.pageId : request.target.ref.source.pageId)) fail('执行文档页面与目标不一致');
  const params = new Map<string, import('@metriccanvas/page/internal').PageParamValue>();
  const declarations = new Map((page.params ?? []).map(p => [p.id, p]));
  for (const [id, value] of Object.entries(response.appliedInputs)) {
    const declaration = declarations.get(id);
    if (!declaration || !matchesParamDeclaration(value, declaration)) fail('实际参数未声明或形状不符');
    params.set(id, structuredClone(value));
  }
  for (const declaration of declarations.values()) if (declaration.required !== false && !params.has(declaration.id)) fail('缺少实际必需参数，不能回退模板默认');
  if (page.schemaVersion === '6.5') for (const [id, value] of Object.entries(request.explicitInputs)) if (!params.has(id) || canonicalizeJson(params.get(id)) !== canonicalizeJson(value)) fail('回执未使用本次明确输入');
  const filters = new Map<string, FilterValue>();
  for (const [id, value] of Object.entries(response.filterValues)) {
    const declaration = page.filters?.find(f => f.id === id);
    if (!declaration || !record(value) || value.type !== declaration.type) fail('实际筛选未声明或类型不符');
    const candidate = new Map([[id, value as unknown as FilterValue]]);
    try {
      const roundTrip = parseFilterSearch(createFilterState(candidate).toURL([declaration]), [declaration]);
      if (canonicalizeJson(roundTrip.get(id)) !== canonicalizeJson(value)) fail('实际筛选形状或维度不符');
    } catch { fail('实际筛选形状或维度不符'); }
    filters.set(id, structuredClone(value) as unknown as FilterValue);
  }
  for (const declaration of page.filters ?? []) {
    if (declaration.type !== 'dimension' || !declaration.initialParam) continue;
    const actual = params.get(declaration.initialParam);
    const expected = actual === undefined ? [] : Array.isArray(actual) ? actual : [actual];
    const filter = filters.get(declaration.id);
    if (canonicalizeJson(filter?.type === 'dimension' ? filter.values : []) !== canonicalizeJson(expected)) fail('实际参数与筛选初值不一致');
  }
  const sourceIds = Object.keys(page.dataSources).filter(id => page.dataSources[id].source.type === 'query');
  if (canonicalizeJson(Object.keys(response.dataSources).sort()) !== canonicalizeJson(sourceIds.sort())) fail('执行结果缺少或包含多余查询源');
  const snapshots = new Map<string, DataSnapshot>();
  let successes = 0;
  for (const id of sourceIds) {
    const item = response.dataSources[id];
    if (!record(item) || item.conditionKey !== response.conditionKey) fail('数据源结果条件不匹配');
    if (item.status === 'success') {
      if (!Array.isArray(item.rows) || 'error' in item || (item.totalCount !== undefined && (!Number.isInteger(item.totalCount) || Number(item.totalCount) < item.rows.length))) fail('成功源必须有有效rows/totalCount且无error');
      if (flattenPageComponents(page).some(c => c.type === 'table' && c.data.main === id && c.props.pagination?.mode === 'query') && item.totalCount === undefined) fail('查询分页成功结果缺少总条数');
      if (item.rowFormat !== undefined && item.rowFormat !== 'page' && item.rowFormat !== 'query') fail('未知结果字段映射形式');
      successes++;
      const source = page.dataSources[id];
      if (source.source.type !== 'query') fail('执行结果来源无效');
      const fields = source.fields as Record<string, QueryDataSourceFieldDefinition>;
      const mappings = item.rowFormat === 'query' ? fields : pageFieldMappings(fields);
      const normalized = normalizeQueryRows(item.rows, mappings);
      if (!normalized.ok) {
        snapshots.set(id, {status:'error',error:{code: normalized.issues.some(i => i.code.includes('MISSING')) ? 'DQE_FIELD_MAPPING_ERROR' : 'DQE_ROW_CONTRACT_ERROR',message:'执行结果不符合字段契约'}});
      } else {
        const total = item.totalCount === undefined ? {} : {totalCount: Number(item.totalCount)};
        snapshots.set(id, normalized.rows.length ? {status:'ready',rows:normalized.rows,...total} : {status:'empty',...total});
      }
    } else if (item.status === 'error') {
      if ('rows' in item || !record(item.error) || (!isQueryErrorCode(item.error.code) && item.error.code !== 'UNKNOWN')) fail('失败源必须有已知错误且不能携带rows');
      snapshots.set(id, {status:'error',error:{code:item.error.code,message:`执行数据源失败(${item.error.code})`}});
    } else fail('数据源结果缺少成功/失败判别');
  }
  const status = successes === sourceIds.length ? 'success' : successes === 0 ? 'error' : 'partial';
  if (response.status !== status) fail('执行总状态与逐源状态不一致');
  const initialized = initializePageParams(page, params);
  const sourceKeys = new Map(sourceIds.map(id => [id, executionSourceKey(initialized.dataSources[id])]));
  return {document: structuredClone(response.document) as PageDocument, target:structuredClone(request.target), operationId:request.operationId, executionId:response.executionId, conditionKey:response.conditionKey, params,filters,snapshots,sourceKeys,...(recordFilters ? {recordFilters} : {})};
}

function pageFieldMappings(fields: Record<string, QueryDataSourceFieldDefinition>): Record<string, QueryDataSourceFieldDefinition> {
  return Object.fromEntries(Object.entries(fields).map(([id, field]) => {
    if (!hasQueryFieldMapping(field)) return [id, field];
    if (field.type !== 'recordList') return [id, {...field,queryField:id}];
    return [id,{...field,queryField:id,items:{...field.items,fields:Object.fromEntries(Object.entries(field.items.fields).map(([key,value]) => [key,{...value,queryField:key}]))}}];
  }));
}
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function validTarget(value: unknown): value is ExecutionTarget {
  if (!record(value) || !record(value.ref)) return false;
  const keys = value.kind === 'draft' ? ['pageId','revisionId','resourceId'] : value.kind === 'candidate' ? ['candidateId','candidateVersion'] : value.kind === 'template' ? ['templateId','templateRevisionId'] : [];
  const ref = value.ref;
  return keys.length > 0 && keys.every(k => nonempty(ref[k])) && (value.kind === 'draft' || validTarget({kind:'draft',ref:ref.source}));
}

export function executionSourceKey(source: import('@metriccanvas/page/internal').DataSource): string {
  return canonicalizeJson({fields:source.fields,query:source.source.type === 'query' ? source.source.query : null});
}
