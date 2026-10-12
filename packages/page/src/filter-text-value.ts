import type { TypedError } from './errors';
import type { FilterDeclaration } from './filter';
import { isValueFormatPreset } from './field';
import {
  formatSuitsParamType, textValueScope,
  type FilterTextValueReference, type PageParamType, type PageParamValue
} from './page-param';

export interface FilterTextValueUsage {
  path: string;
  reference: FilterTextValueReference;
}

/** 无时钟求值的已初始化默认值；相对时间由执行/运行时的实际筛选状态提供。 */
export function initialFilterTextValues(declarations: readonly FilterDeclaration[]): ReadonlyMap<string, PageParamValue> {
  const values = new Map<string, PageParamValue>();
  for (const filter of declarations) {
    const value = filter.default;
    if (value === undefined) continue;
    if (filter.type === 'timeRange') {
      const range = filter.default;
      if (range && typeof range === 'object' && 'from' in range && 'to' in range) {
        values.set(filter.id, { start: range.from, end: range.to });
      }
    } else if (filter.type === 'numberRange') {
      const range = filter.default!;
      const text = range.from === undefined ? (range.to === undefined ? undefined : `≤ ${range.to}`) :
        range.to === undefined ? `≥ ${range.from}` : `${range.from} 至 ${range.to}`;
      if (text !== undefined) values.set(filter.id, text);
    } else if (filter.type === 'boolean') {
      if (filter.default === true) values.set(filter.id, true);
    } else if (filter.type === 'dimension') {
      if (filter.default?.length) values.set(filter.id, filter.default);
    } else if (filter.type === 'timePoint' && filter.default !== undefined) {
      values.set(filter.id, filter.default);
    } else if (filter.type === 'search' && filter.default?.trim()) {
      values.set(filter.id, filter.default);
    }
  }
  return values;
}

export function isFilterTextValueReference(value: unknown): value is FilterTextValueReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const node = value as Record<string, unknown>;
  return typeof node.filter === 'string' &&
    Object.keys(node).every(key => key === 'filter' || key === 'format') &&
    (node.format === undefined || isValueFormatPreset(node.format));
}

/** 仅扫描声明文本，不能把不透明 DQE 请求或业务数据当作引用。 */
export function collectFilterTextValueReferences(document: unknown): FilterTextValueUsage[] {
  const usages: FilterTextValueUsage[] = [];
  visit(textValueScope(document), '');
  return usages;
  function visit(value: unknown, path: string): void {
    if (isFilterTextValueReference(value)) {
      usages.push({ path, reference: value });
    } else if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}/${index}`));
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        visit(child, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
      }
    }
  }
}

export function filterTextValueErrors(document: unknown, declarations: readonly FilterDeclaration[]): TypedError[] {
  const byId = new Map(declarations.map(filter => [filter.id, filter]));
  const errors: TypedError[] = [];
  for (const { path, reference } of collectFilterTextValueReferences(document)) {
    const filter = byId.get(reference.filter);
    if (!filter) {
      errors.push({ type: 'SCHEMA_ERROR', path: `${path}/filter`, message: `文本取值引用了未声明的筛选器:${reference.filter}` });
      continue;
    }
    const type: PageParamType = filter.type === 'numberRange' ? 'number' :
      filter.type === 'timePoint' ? 'time' : filter.type === 'search' ? 'string' : filter.type;
    if (reference.format && !formatSuitsParamType(reference.format, type)) {
      errors.push({ type: 'SCHEMA_ERROR', path: `${path}/format`, message: `格式 ${reference.format} 与筛选器 ${filter.id} 的类型 ${filter.type} 不相容` });
    }
  }
  return errors;
}

/** 只复制引用路径上的声明对象；查询/数据快照与参数保持原身份、原值。 */
export function applyFilterTextValues<T>(
  page: T, usages: readonly FilterTextValueUsage[], resolve: (reference: FilterTextValueReference) => string
): T {
  let projected: unknown = page;
  for (const { path, reference } of usages) {
    const keys = path.slice(1).split('/').map(key => key.replaceAll('~1', '/').replaceAll('~0', '~'));
    projected = replace(projected, keys, resolve(reference));
  }
  return projected as T;
  function replace(node: unknown, keys: string[], value: string): unknown {
    if (!keys.length) return value;
    const [key, ...rest] = keys;
    if (Array.isArray(node)) {
      const copy = [...node];
      copy[Number(key)] = replace(node[Number(key)], rest, value);
      return copy;
    }
    const object = node as Record<string, unknown>;
    return { ...object, [key]: replace(object?.[key], rest, value) };
  }
}
