import {ordinaryQuery} from './time-mode';
import { isBoundedResultSource } from './query-dependencies';
import type { Page } from './page';
import type { TypedError } from './errors';
import { computeDependencies, computeOutputFields, type ComputeOperator } from './compute';
import { flattenPageComponents } from './component-walk';
import type { DataSource } from './data-source';
import type { FieldDefinition } from './field';

type ErrorReporter = (path: string, message: string) => void;
type FullRowsCheck = (id: string, source: DataSource, path: string) => void;
type JoinOperator = Extract<ComputeOperator, { op: 'joinAggregate' }>;
const pointer = (id: string) => `/dataSources/${id.replaceAll('~', '~0').replaceAll('/', '~1')}`;

/** 跨源约束只用于新算子，不收紧存量单源页面。 */
export function crossSourceComputeErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const error: ErrorReporter = (path, message) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  const paged = new Set(flattenPageComponents(page).flatMap(component =>
    component.type === 'table' && component.props.pagination?.mode === 'query' ? [component.data.main] : []));
  const full: FullRowsCheck = (id, source, path) => fullRowsErrors(id, source, path, paged, error);
  for (const [id, source] of Object.entries(page.dataSources)) sourceComputeErrors(page, id, source, full, error);
  dependencyCycleErrors(page, error);
  return errors;
}

function fullRowsErrors(id: string, source: DataSource, path: string, paged: ReadonlySet<string>, error: ErrorReporter): void {
  if (source.source.type === 'inline') return;
  if ((source.source.type === 'pagedJoin' || source.source.type === 'pagedUnion')) { error(path, '组合源是窗口结果，不能用于完整跨源计算'); return; }
  const query = ordinaryQuery(source.source.query).body.dsl_list[0];
  const order = query?.order;
  if (source.source.resultScope !== 'complete' || paged.has(id) ||
    (order && typeof order === 'object' && ('limit' in order || 'offset' in order))) {
    error(path, `跨源计算要求完整行集；查询源 ${id} 必须声明 resultScope: complete，且不得带查询分页窗口`);
  }
}

function compatible(a: FieldDefinition, b: FieldDefinition): boolean {
  return a.type === b.type && a.role === b.role && ('unit' in a ? a.unit : undefined) === ('unit' in b ? b.unit : undefined) &&
    (a.type !== 'money' || (b.type === 'money' && a.currency === b.currency));
}

function sourceComputeErrors(page: Page, id: string, source: DataSource, full: FullRowsCheck, error: ErrorReporter): void {
  const operators = source.compute ?? [];
  if (!operators.some(op => ['joinAggregate', 'sumFields', 'cagr', 'timeFill', 'selectField'].includes(op.op))) return;
  if (operators.some(op => op.op === 'timeFill' || (op.op === 'joinAggregate' && !isBoundedResultSource(page.dataSources, id)))) full(id, source, pointer(id));
  const produced = new Set(computeOutputFields(operators));
  const available = new Set(Object.keys(source.fields).filter(field => !produced.has(field)));
  for (const [index, op] of operators.entries()) {
    const path = `${pointer(id)}/compute/${index}`;
    operatorFilterErrors(page, op, path, error);
    if (op.op === 'joinAggregate') joinErrors(page, source, op, available, path, full, error);
    for (const field of operatorInputs(op)) if (!available.has(field)) error(path, `算子输入尚不可用:${field}`);
    for (const field of computeOutputFields([op])) available.add(field);
  }
}

function operatorFilterErrors(page: Page, op: ComputeOperator, path: string, error: ErrorReporter): void {
  if (op.op === 'selectField' && !page.filters?.some(f => f.id === op.filter && f.type === 'dimension')) error(`${path}/filter`, '字段模式必须引用已声明的维度筛选器');
  if (op.op === 'timeFill' && 'filter' in op.range) {
    const filterId = op.range.filter;
    if (!page.filters?.some(f => f.id === filterId && f.type === 'timeRange')) error(`${path}/range/filter`, '时间补齐范围必须引用时间范围筛选器');
  }
}

function joinErrors(page: Page, source: DataSource, op: JoinOperator, available: ReadonlySet<string>, path: string, full: FullRowsCheck, error: ErrorReporter): void {
  const dependency = Object.hasOwn(page.dataSources, op.source) ? page.dataSources[op.source] : undefined;
  if (!dependency) { error(`${path}/source`, `未知数据依赖:${op.source}`); return; }
  full(op.source, dependency, `${path}/source`);
  joinKeyErrors(source, dependency, op.keys, available, path, error);
  joinValueErrors(source, dependency, op.values, path, error);
}

function joinKeyErrors(source: DataSource, dependency: DataSource, keys: JoinOperator['keys'], available: ReadonlySet<string>, path: string, error: ErrorReporter): void {
  const local = new Set<string>(), foreign = new Set<string>();
  for (const [index, key] of keys.entries()) {
    const a = source.fields[key.local], b = dependency.fields[key.foreign];
    if (!available.has(key.local) || !a || !b || a.role !== 'dimension' || b.role !== 'dimension' || !compatible(a, b)) error(`${path}/keys/${index}`, '组合键必须引用可用且类型、单位相容的维度字段');
    if (local.has(key.local) || foreign.has(key.foreign)) error(`${path}/keys/${index}`, '组合键字段不得重复');
    local.add(key.local);
    foreign.add(key.foreign);
  }
}

function joinValueErrors(source: DataSource, dependency: DataSource, values: JoinOperator['values'], path: string, error: ErrorReporter): void {
  for (const [index, value] of values.entries()) {
    const input = dependency.fields[value.field], output = source.fields[value.output];
    if (!input || !output || input.role !== 'measure' || !['number', 'money'].includes(input.type) || !compatible(input, output)) error(`${path}/values/${index}`, '关联度量与产出字段必须为相同类型、单位、币种的数值度量');
    if (output?.nullable === false) error(`${path}/values/${index}/output`, '缺关联行产出 null，字段必须允许为空');
    if (value.aggregate === 'sum' && (!input || input.role !== 'measure' || input.collapsible !== true)) error(`${path}/values/${index}/aggregate`, 'sum 要求依赖字段显式声明 collapsible: true');
  }
}

// Keep the closed operator set explicit; input order determines diagnostics.
function operatorInputs(op: ComputeOperator): string[] {
  switch (op.op) {
    case 'timeFill': return [op.timeField, ...op.measures, ...(op.groupBy ?? [])];
    case 'selectField': return Object.values(op.cases);
    case 'sumFields': return op.fields;
    case 'cagr': return [op.beginning, op.ending, op.periods];
    case 'ratio': return [op.numerator, op.denominator];
    case 'delta': return [op.minuend, op.subtrahend];
    case 'pivot': return [op.categoryField, op.valueField, ...op.columns.flatMap(c => c.valueField ? [c.valueField] : []), ...(op.keyFields ?? [])];
    case 'grandTotal': return op.measures;
    case 'groupSubtotal': return [op.groupBy, ...op.measures];
    default: return [];
  }
}

function dependencyCycleErrors(page: Page, error: ErrorReporter): void {
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) { error(pointer(id), '页面数据源计算依赖不得成环'); return; }
    if (visited.has(id) || !Object.hasOwn(page.dataSources, id)) return;
    visiting.add(id);
    for (const dependency of computeDependencies(page.dataSources[id].compute ?? [])) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of Object.keys(page.dataSources)) visit(id);
}
