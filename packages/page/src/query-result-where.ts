import { hasQueryFieldMapping, type QueryDataSourceFieldDefinition } from './field';
import { matchesFieldValue } from './result-field-contract';
import type { QueryResultWhere } from './query';
import type { Row } from './snapshot';
import type { TypedError } from './errors';

export const MAX_QUERY_RESULT_WHERE_DEPTH = 4;
export const MAX_QUERY_RESULT_WHERE_LEAVES = 64;
export const MAX_QUERY_RESULT_WHERE_VALUES = 1000;

/** Semantic checks shared by page validation and execution; literals never get coerced. */
export function queryResultWhereErrors(
  where: QueryResultWhere,
  fields: Record<string, QueryDataSourceFieldDefinition>,
  path: string
): TypedError[] {
  const errors: TypedError[] = [];
  const fail = (at: string, message: string) => errors.push({ type: 'SCHEMA_ERROR' as const, path: at, message });
  let leaves = 0;
  function visit(node: QueryResultWhere, at: string, depth: number): void {
    if ('all' in node || 'any' in node) {
      const key = 'all' in node ? 'all' : 'any';
      const children = 'all' in node ? node.all : node.any;
      if (!children.length || children.length > MAX_QUERY_RESULT_WHERE_LEAVES) { fail(at, '查询输入过滤组合必须包含1到64个条件'); return; }
      if (depth >= MAX_QUERY_RESULT_WHERE_DEPTH) { fail(at, '查询输入过滤组合超过4层'); return; }
      children.forEach((child, index) => visit(child, `${at}/${key}/${index}`, depth + 1));
      return;
    }
    leaves++;
    const field = fields[node.field];
    if (!field || !hasQueryFieldMapping(field) || ['recordList', 'semanticHtml'].includes(field.type)) {
      fail(`${at}/field`, '查询输入过滤必须引用同一上游查询的原始标量字段'); return;
    }
    if (['gt', 'gte', 'lt', 'lte'].includes(node.op) && !['number', 'money'].includes(field.type)) {
      fail(`${at}/op`, '查询输入有序比较只支持number或money字段'); return;
    }
    if ('values' in node && (!node.values.length || node.values.length > MAX_QUERY_RESULT_WHERE_VALUES)) {
      fail(`${at}/values`, '查询输入过滤集合必须包含1到1000个字面量'); return;
    }
    const values = 'values' in node ? node.values : 'value' in node ? [node.value] : [];
    values.forEach((value, index) => {
      if (!matchesFieldValue(value, field)) fail(`${at}/${'values' in node ? `values/${index}` : 'value'}`, '查询输入过滤字面量与字段类型不符');
    });
  }
  visit(where, path, 0);
  if (leaves > MAX_QUERY_RESULT_WHERE_LEAVES) fail(path, '查询输入过滤超过64个叶子条件');
  return errors;
}

/** Read-only projection. Validate all referenced values before any boolean short circuit. */
export function filterQueryResultRows(
  rows: Row[],
  where: QueryResultWhere,
  fields: Record<string, QueryDataSourceFieldDefinition>
): Row[] {
  if (queryResultWhereErrors(where, fields, '').length) throw new Error('查询输入过滤声明不合法');
  const referenced = new Set<string>();
  function collect(node: QueryResultWhere): void {
    if ('all' in node) node.all.forEach(collect);
    else if ('any' in node) node.any.forEach(collect);
    else referenced.add(node.field);
  }
  collect(where);
  for (const row of rows) for (const field of referenced) {
    if (!Object.hasOwn(row, field) || !matchesFieldValue(row[field], fields[field])) throw new Error('查询输入过滤字段缺失或类型不合法');
  }
  function match(row: Row, node: QueryResultWhere): boolean {
    if ('all' in node) return node.all.every(child => match(row, child));
    if ('any' in node) return node.any.some(child => match(row, child));
    const value = row[node.field];
    if (node.op === 'isNull') return value === null;
    if (node.op === 'isNotNull') return value !== null;
    if (value === null) return false;
    switch (node.op) {
      case 'eq': return value === node.value;
      case 'ne': return value !== node.value;
      case 'in': return node.values.some(candidate => candidate === value);
      case 'notIn': return !node.values.some(candidate => candidate === value);
      case 'gt': return typeof value === 'number' && value > node.value;
      case 'gte': return typeof value === 'number' && value >= node.value;
      case 'lt': return typeof value === 'number' && value < node.value;
      case 'lte': return typeof value === 'number' && value <= node.value;
    }
  }
  return rows.filter(row => match(row, where));
}
