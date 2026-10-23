import { dqeDimensionConditions, isObjectDqeItem } from './dqe-object';
import {ordinaryQuery,queryLeaves} from './query-selection';
import type { TypedError } from './errors';
import { pageParamDeclarations, type PageParamDeclaration, type GroupedPageParams } from './page-param';
import type { FilterDeclaration } from './filter';
import { bindingQueryFields, isLevelDimensionBinding, type DqeQueryDefinition } from './query';
import { resolveTimeWindow, timeWindowCompatible } from './time-param';

type BindingPage = { params?: PageParamDeclaration[] | GroupedPageParams; filters?: FilterDeclaration[]; dataSources: Record<string, { source: { type: string; query?: DqeQueryDefinition } }> };
type ParamBinding = NonNullable<DqeQueryDefinition['paramBindings']>[string];
type ErrorReporter = (path: string, message: string) => void;

/** 结构校验后的参数绑定不变量；不从字段名猜目标，不解释任意表达式。 */
export function paramBindingErrors(document: unknown): TypedError[] {
  const page = document as BindingPage;
  const params = new Map(pageParamDeclarations(page.params).map(p => [p.id, p]));
  const filters = new Map((page.filters ?? []).map(f => [f.id, f]));
  const errors: TypedError[] = [];
  const error: ErrorReporter = (path, message) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  const consumers = new Set<string>();
  for (const [sourceId, source] of Object.entries(page.dataSources)) {
    const query = source.source.query;
    if (source.source.type !== 'query' || !query) continue;
    for (const leaf of queryLeaves(query)) queryBindingErrors(sourceId, leaf, params, filters, consumers, error);
  }
  (page.filters ?? []).forEach((filter, index) => initialFilterErrors(filter, index, params, consumers, error));
  return errors;
}

function queryBindingErrors(sourceId: string, query: DqeQueryDefinition, params: ReadonlyMap<string, PageParamDeclaration>, filters: ReadonlyMap<string, FilterDeclaration>, consumers: Set<string>, error: ErrorReporter): void {
  const owners = new Map<string, string>();
  let timeOwner: string | undefined;
  for (const [id, binding] of Object.entries(query.paramBindings ?? {})) {
    const path = `/dataSources/${pointer(sourceId)}/source/query/paramBindings/${pointer(id)}`;
    if (binding.target === 'time') {
      timeParamErrors(query, binding, params.get(id), timeOwner !== undefined, path, error);
      timeOwner = id;
    } else dimensionParamErrors(query, id, binding, params, filters, owners, consumers, path, error);
  }
  for (const [filterId, binding] of Object.entries(query.filterBindings ?? {})) {
    initializedBindingErrors(sourceId, filterId, binding, filters.get(filterId), owners, consumers, error);
  }
}

function timeParamErrors(query: DqeQueryDefinition, binding: Extract<ParamBinding, { target: 'time' }>, declaration: PageParamDeclaration | undefined, duplicate: boolean, path: string, error: ErrorReporter): void {
  if (declaration?.type !== 'time' || !declaration.required) error(path, '时间绑定必须引用必需的time参数');
  if (duplicate) error(path, '同一查询的时间只能有一个参数来源');
  if (Object.values(query.filterBindings ?? {}).some(f => f.target === 'time')) error(path, '固定时间参数不得与页内时间筛选器共同控制查询');
  const item=ordinaryQuery(query).body.dsl_list[0];
  if(isObjectDqeItem(item)){if(!binding.queryField||!binding.valueFormat)error(path,'object 时间参数必须声明 queryField 和 valueFormat');}
  else timeBodyErrors(query, declaration, path, error);
  if (declaration?.granularity && !timeWindowCompatible(declaration.granularity, binding.window)) error(path, '时间窗口单位与参数精度不相容');
  if (typeof declaration?.default === 'string') {
    try { resolveTimeWindow(declaration.default, binding.window); }
    catch { error(path, '默认时间无法生成合法查询窗口'); }
  }
}

function timeBodyErrors(query: DqeQueryDefinition, declaration: PageParamDeclaration | undefined, path: string, error: ErrorReporter): void {
  const filter = ordinaryQuery(query).body.dsl_list[0].filter;
  const time = filter && typeof filter === 'object' && !Array.isArray(filter) ? filter.time : undefined;
  if (!time || typeof time !== 'object' || Array.isArray(time)) {
    error(path, '时间绑定需要显式filter.time，保留查询粒度与聚合设置');
    return;
  }
  if ('start' in time || 'end' in time) error(path, '时间绑定不得另有查询体起止默认值');
  const period = declaration?.granularity === 'month' ? 'month' : 'day';
  if (time.period !== period) error(path, `时间参数精度要求查询period=${period}；第一版不隐式转换查询粒度`);
}

function bodyHasDimensionDefault(query: DqeQueryDefinition, queryField: string): boolean {
  return dqeDimensionConditions(ordinaryQuery(query).body.dsl_list[0]).some(condition=>condition.dim_name===queryField);
}

function dimensionParamErrors(query: DqeQueryDefinition, id: string, binding: Extract<ParamBinding, { target: 'dimension' }>, params: ReadonlyMap<string, PageParamDeclaration>, filters: ReadonlyMap<string, FilterDeclaration>, owners: Map<string, string>, consumers: Set<string>, path: string, error: ErrorReporter): void {
  if (params.get(id)?.type !== 'dimension') error(path, '查询参数绑定必须引用已声明的dimension参数');
  if (owners.has(binding.queryField)) error(path, '同一查询目标只能有一个参数来源');
  owners.set(binding.queryField, id);
  if (bodyHasDimensionDefault(query, binding.queryField)) error(path, '参数绑定目标不得另有查询体默认条件');
  const matching = Object.entries(query.filterBindings ?? {}).filter(([, f]) => bindingQueryFields(f).includes(binding.queryField));
  if (matching.length > 1) error(path, '参数绑定目标不得由多个筛选器控制');
  for (const [filterId] of matching) {
    const declaration = filters.get(filterId);
    if (declaration?.type !== 'dimension' || declaration.initialParam !== id) error(path, '查询与筛选必须引用同一参数初值来源');
    else consumers.add(filterId);
  }
}

function initializedBindingErrors(sourceId: string, filterId: string, binding: NonNullable<DqeQueryDefinition['filterBindings']>[string], declaration: FilterDeclaration | undefined, owners: ReadonlyMap<string, string>, consumers: Set<string>, error: ErrorReporter): void {
  // Hierarchy initial values must land on the explicitly bound default level.
  if (declaration?.type === 'dimension' && declaration.initialParam &&
    (binding.target !== 'dimension' || owners.get(initialQueryField(declaration, binding)) !== declaration.initialParam)) {
    error(`/dataSources/${pointer(sourceId)}/source/query/filterBindings/${pointer(filterId)}`, '参数初始化筛选的每个查询目标都必须显式绑定同一参数');
  }
  // Time-point values have no separate paramBindings target.
  if ((declaration?.type === 'timePoint' || declaration?.type === 'timeRange') && declaration.initialParam && (binding.target === 'timePoint' || binding.target === 'time')) consumers.add(filterId);
}

function initialFilterErrors(filter: FilterDeclaration, index: number, params: ReadonlyMap<string, PageParamDeclaration>, consumers: ReadonlySet<string>, error: ErrorReporter): void {
  if (filter.type !== 'dimension' && filter.type !== 'timePoint' && filter.type !== 'timeRange') return;
  if (filter.initialParam === undefined) return;
  const path = `/filters/${index}/initialParam`;
  const declaration = params.get(filter.initialParam);
  if (filter.default !== undefined) error(path, '参数初始化与筛选default互斥，默认来源只能声明一次');
  if (!consumers.has(filter.id)) error(path, '参数初始化筛选必须具有匹配的显式查询目标');
  if (filter.type === 'dimension') {
    if (declaration?.type !== 'dimension') error(path, '筛选初值必须引用已声明的dimension参数');
    return;
  }
  timeInitialErrors(filter, declaration, path, error);
}

function timeInitialErrors(filter: Extract<FilterDeclaration, { type: 'timePoint' | 'timeRange' }>, declaration: PageParamDeclaration | undefined, path: string, error: ErrorReporter): void {
  if (declaration?.type !== 'timeRange' || !declaration.required) error(path, '时间点筛选初值必须引用必需的 times 参数');
  else if (declaration.granularity !== (filter.type === 'timePoint' ? filter.granularity : filter.precision ?? 'date')) error(path, '时间点筛选初值的参数精度必须与筛选器一致');
  else if (filter.type === 'timePoint' && isRange(declaration.value) && declaration.value.start !== declaration.value.end) error(path, '时间点筛选初值要求参数是单点');
}


/** 参数初始化落到哪个查询字段:层级绑定取缺省层，恒定绑定取那一个字段。 */
function initialQueryField(filter: FilterDeclaration & { type: 'dimension' }, binding: { target: 'dimension' } & Record<string, unknown>): string {
  if (!isLevelDimensionBinding(binding as never)) return String((binding as { queryField?: string }).queryField);
  const level = filter.defaultLevel ?? filter.hierarchy?.[0]?.id;
  const fields = (binding as unknown as { levelQueryFields: Record<string, string> }).levelQueryFields;
  return level === undefined ? '' : fields[level] ?? '';
}


function isRange(value: unknown): value is { start: string; end: string } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    typeof (value as { start?: unknown }).start === 'string' && typeof (value as { end?: unknown }).end === 'string';
}

function pointer(s: string): string { return s.replaceAll('~', '~0').replaceAll('/', '~1'); }
