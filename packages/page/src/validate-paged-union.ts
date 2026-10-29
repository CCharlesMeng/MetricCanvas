import { validateContractRows } from './result-field-contract';
import { hasQueryFieldMapping, type FieldDefinition } from './field';
import { queryLeaves } from './query-selection';
import type { Page } from './page';
import type { QueryDataSource } from './data-source';
import type { PagedUnionDataSource, PagedUnionMember } from './paged-union';
import type { TypedError } from './errors';
import { queryFilterIds } from './amount-filter';
import { consumerErrors, initialErrors } from './validate-paged-join';
import { unionMemberKeyFields, validGeneratedUnionKey, validUnionKeyPart } from './paged-union-identity';

type Fail = (path: string, message: string) => void;
const ptr = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1');
export function pagedUnionErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const fail: Fail = (path, message) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  for (const [id, data] of Object.entries(page.dataSources)) {
    if (data.source.type !== 'pagedUnion') continue;
    const union = data as PagedUnionDataSource, path = `/dataSources/${ptr(id)}`;
    identityErrors(union, path, fail);
    for (const [name, member] of Object.entries(union.source.members)) {
      memberErrors(page, union, member, `${path}/source/members/${ptr(name)}`, fail);
    }
    unionOrderingErrors(union, path, fail);
    consumerErrors(page, id, union.source, path, fail);
    initialErrors(union, path, fail);
    initialIdentityErrors(page, union, path, fail);
  }
  return errors;
}
function identityErrors(data: PagedUnionDataSource, path: string, fail: Fail): void {
  const { rowKey, sourceField } = data.source;
  if (Object.keys(data.source.members).length < 2) fail(`${path}/source/members`, '合并至少需要两个来源');
  if (rowKey === sourceField) fail(`${path}/source/sourceField`, '来源字段与行键必须不同');
  for (const id of [rowKey, sourceField]) {
    const field = data.fields[id];
    if (!field || field.type !== 'string' || field.role !== 'dimension' || field.nullable !== false) fail(`${path}/fields/${ptr(id)}`, '合并行键与来源标识必须声明为非空 string 维度');
  }
  for (const [id, field] of Object.entries(data.fields)) {
    if ('queryField' in field || field.role === 'detail') fail(`${path}/fields/${ptr(id)}`, '合并结果只声明无 queryField 的标量字段');
  }
}
function memberErrors(page: Page, data: PagedUnionDataSource, member: PagedUnionMember, path: string, fail: Fail): void {
  const ref = Object.hasOwn(page.dataSources, member.source) ? page.dataSources[member.source] : undefined;
  if (!ref || ref.source.type !== 'query') { fail(`${path}/source`, '合并成员必须引用普通查询源'); return; }
  const input = ref as QueryDataSource;
  memberInputErrors(input, member, path, fail);
  for (const field of Object.keys(data.fields)) {
    if ([data.source.rowKey, data.source.sourceField].includes(field)) continue;
    projectionErrors(data.fields[field], member.projection[field], input, `${path}/projection/${ptr(field)}`, fail);
  }
  for (const field of Object.keys(member.projection)) {
    if (!data.fields[field] || [data.source.rowKey, data.source.sourceField].includes(field)) fail(`${path}/projection/${ptr(field)}`, '投影必须引用已声明的非身份字段');
  }
  const consumed = allMemberFilters(page, data);
  for (const filter of consumed) if (!queryFilterIds(ref.source.query).includes(filter)) fail(`${path}/source`, '每个成员必须显式消费全部合并业务筛选');
}
function allMemberFilters(page: Page, data: PagedUnionDataSource): Set<string> {
  return new Set(Object.values(data.source.members).flatMap(member => {
    const ref = Object.hasOwn(page.dataSources, member.source) ? page.dataSources[member.source] : undefined;
    return ref?.source?.type === 'query' ? queryFilterIds(ref.source.query) : [];
  }));
}
function hasWindow(value: unknown): boolean {
  return !!value && typeof value === 'object' && ('limit' in value || 'offset' in value);
}
function projectionErrors(output: FieldDefinition, projection: PagedUnionMember['projection'][string] | undefined, input: QueryDataSource, path: string, fail: Fail): void {
  if (!projection) { fail(path, '每个来源必须显式声明字段、常量或 null 投影'); return; }
  if ('value' in projection) {
    if (!validLiteral(output, projection.value)) fail(path, '投影常量与输出字段类型或可空性不相容');
    return;
  }
  const field = input.fields[projection.field];
  if (!field || !hasQueryFieldMapping(field)) { fail(path, '投影必须引用来源原始字段'); return; }
  if (!compatible(field, output)) fail(path, '投影类型、角色、单位、币种及可空性必须相容');
}
function compatible(input: FieldDefinition, output: FieldDefinition): boolean {
  return input.type === output.type && input.role === output.role &&
    ('unit' in input ? input.unit : undefined) === ('unit' in output ? output.unit : undefined) &&
    (output.type !== 'money' || (input.type === 'money' && input.currency === output.currency)) &&
    (output.nullable !== false || input.nullable === false);
}
function validLiteral(field: FieldDefinition, value: unknown): boolean {
  return validateContractRows([{ value }], { value: field }).ok;
}

function unionOrderingErrors(data: PagedUnionDataSource, path: string, fail: Fail): void {
  if (new Set(data.source.ordering.sortableFields).size !== data.source.ordering.sortableFields.length) fail(`${path}/source/ordering/sortableFields`, '可排序字段不得重复');
  const fields = [...data.source.ordering.sortableFields, ...data.source.ordering.default.map(rule => rule.field)];
  if (new Set(data.source.ordering.default.map(rule => rule.field)).size !== data.source.ordering.default.length) fail(`${path}/source/ordering/default`, '默认排序字段不得重复');
  for (const id of fields) {
    if (!data.fields[id] || !['string','number','money','date','datetime'].includes(data.fields[id].type) || id === data.source.rowKey) fail(`${path}/source/ordering`, '排序字段必须是已声明的可比较投影字段或来源字段');
  }
}

function memberInputErrors(ref: QueryDataSource, member: PagedUnionMember, path: string, fail: Fail): void {
  const fields = unionMemberKeyFields(member);
  if (new Set(fields).size !== fields.length) fail(`${path}/rowKeyFields`, '组合行键字段不得重复');
  fields.forEach((id, index) => {
    const key = ref.fields[id];
    const keyPath = 'rowKeyFields' in member ? `rowKeyFields/${index}` : 'rowKey';
    if (!key || !hasQueryFieldMapping(key) || key.role !== 'dimension' || !['string', 'number'].includes(key.type) || key.nullable !== false) fail(`${path}/${keyPath}`, '来源内行键必须是非空 string/number 原始维度');
  });
  if (ref.compute?.length || ref.source.query.resultBindings?.length || queryLeaves(ref.source.query).some(query => hasWindow(query.body.dsl_list[0].order))) fail(`${path}/source`, '成员不允许计算、结果绑定或业务分页窗口');
 }

function initialIdentityErrors(page: Page, data: PagedUnionDataSource, path: string, fail: Fail): void {
  const seen = new Set<string>();
  for (const row of data.source.initial?.rows ?? []) {
    const identity = parsedIdentity(row[data.source.rowKey]);
    const member = identity && Object.hasOwn(data.source.members, identity[0]) ? data.source.members[identity![0]] : undefined;
    if (!identity || !member || row[data.source.sourceField] !== identity[0] || !initialKeyMatches(page, member, identity[1])) fail(`${path}/source/initial/rows`, '初始合并行键必须编码已声明来源及正确类型的来源内键');
    else if (!('rowKey' in member)) {
      const key = JSON.stringify(identity);
      const label = 'rowKeyFields' in member ? '组合行键' : 'UUID行键';
      if (seen.has(key)) fail(`${path}/source/initial/rows`, `初始合并${label}不得重复`);
      seen.add(key);
    }
  }
}
function initialKeyMatches(page: Page, member: PagedUnionMember, key: unknown): boolean {
  if ('rowKeyGeneration' in member) return validGeneratedUnionKey(key);
  const fields = unionMemberKeyFields(member);
  const values = 'rowKeyFields' in member ? key : [key];
  if (!Array.isArray(values) || values.length !== fields.length) return false;
  const source = page.dataSources[member.source];
  return fields.every((id, index) => validUnionKeyPart(values[index], source?.fields[id]?.type));
}
function parsedIdentity(value: unknown): [string, unknown] | undefined {
  if (typeof value !== 'string') return;
  try {
    const pair: unknown = JSON.parse(value);
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') return;
    return [pair[0], pair[1]];
  } catch { return; }
}
