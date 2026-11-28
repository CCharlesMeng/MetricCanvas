import { tableHeaderParamReferences, tableHeaderParamDeclarationErrors } from './table/header-params';
import { chartOptionScopes } from './chart-option';
import type { TypedError } from './errors';
import { isValueFormatPreset, type ValueFormatPreset } from './field';
import { matchesTimeValue, type TimeParamGranularity } from './time-param';
import {
  isQueryInputDeclaration,
  pageParamDeclarations,
  type FilterTextValueReference,
  type GroupedPageParams,
  type PageParamDeclaration,
  type PageParamType,
  type PageParamValue,
  type TextValue,
  type TextValueComposition,
  type TextValueReference,
  type TextValueReferenceUsage,
  type TimeRangeParamValue,
} from './page-param-types';

export {
  isQueryInputDeclaration,
  pageParamDeclarations,
  type FilterTextValueReference,
  type GroupedPageParams,
  type PageParamDeclaration,
  type PageParamType,
  type PageParamValue,
  type TextValue,
  type TextValueComposition,
  type TextValueReference,
  type TextValueReferenceUsage,
  type TimeRangeParamValue,
};

export function isTextValueComposition(value: unknown): value is TextValueComposition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const node = value as Record<string, unknown>;
  return Object.keys(node).length === 1 && Array.isArray(node.parts) && node.parts.every(part=>typeof part==='string'||isTextValueReference(part)||!!part&&typeof part==='object'&&Object.keys(part).every(key=>key==='filter'||key==='format')&&typeof part.filter==='string');
}

export function collectTextValueCompositions(document: unknown): Array<{ path: string; value: TextValueComposition }> {
  const opaque = chartOptionScopes(document);
  const usages: Array<{ path: string; value: TextValueComposition }> = [];
  visit(textValueScope(document), '');
  return usages;
  function visit(value: unknown, path: string): void {
    if (value && typeof value === 'object' && opaque.has(value)) return;
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((child, index) => visit(child, `${path}/${index}`)); return; }
    if (isTextValueComposition(value)) { usages.push({ path, value }); return; }
    for (const [key, child] of Object.entries(value)) visit(child, `${path}/${escapePointer(key)}`);
  }
}

/**
 * 文本取值引用在声明扫描范围内按形状识别；DQE/数据与图表选项不透明子树先被排除,
 * 因此不需要维护一张逐文本位置枚举的白名单——ADR-0047 的规则本就落在位置上。
 */
export function isTextValueReference(value: unknown): value is TextValueReference {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (!keys.includes('param') || keys.some((key) => key !== 'param' && key !== 'format')) {
    return false;
  }
  const candidate = value as { param: unknown; format?: unknown };
  return (
    typeof candidate.param === 'string' &&
    (candidate.format === undefined || isValueFormatPreset(candidate.format))
  );
}

/** 数值语义的格式预设:只有 number 参数能引用。 */
const NUMERIC_FORMATS = new Set<ValueFormatPreset>([
  'number',
  'number-0',
  'number-1',
  'number-signed',
  'number-1-signed',
  'number-2-signed',
  'number-3-signed',
  'number-4-signed',
  'number-5-signed',
  'number-grouped-signed',
  'number-2',
  'number-3',
  'number-4',
  'number-5',
  'number-grouped',
  'number-ungrouped',
  'number-0-ungrouped',
  'number-1-ungrouped',
  'number-2-ungrouped',
  'number-3-ungrouped',
  'number-4-ungrouped',
  'number-5-ungrouped',
  'number-ungrouped-signed',
  'number-1-ungrouped-signed',
  'number-2-ungrouped-signed',
  'number-3-ungrouped-signed',
  'number-4-ungrouped-signed',
  'number-5-ungrouped-signed',
  'compact-wan-0',
  'compact-wan-1',
  'compact-million-0',
  'compact-million-1',
  'compact-million-2',
  'compact-yi-1',
  'cny-adaptive',
  'usd-adaptive',
  'cny-adaptive-trimmed',
  'cny-adaptive-trimmed-no-yuan',
  'usd-adaptive-km',
  'percent-0',
  'percent-1',
  'percent-2',
  'points-1-signed',
  'yoy-p-signed',
  'percent-2-signed'
]);

/** 日历语义的格式预设:参数值是日历字符串时才有意义。 */
const DATE_FORMATS = new Set<ValueFormatPreset>(['date', 'date-month-day']);

export function formatSuitsParamType(
  format: ValueFormatPreset,
  type: PageParamType
): boolean {
  if (format === 'period') return type === 'time' || type === 'timeRange';
  if (NUMERIC_FORMATS.has(format)) return type === 'number';
  if (DATE_FORMATS.has(format)) return type === 'string';
  return true;
}

/**
 * 文本取值的作用域:页面文档里除 `dataSources` 以外的部分。
 *
 * 数据源承载的是不透明的协议请求体与业务数据行,不是页面声明。把它们排除
 * 在外,一是让「文本取值只出现在声明里」这条边界显式,二是避免按形状识别时
 * 把恰好只有一个 `param` 键的请求体片段或数据行误判为引用。
 */
export function textValueScope(document: unknown): unknown {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    return document;
  }
  const { dataSources: _dataSources, ...rest } = document as Record<string, unknown>;
  return rest;
}

export function collectTextValueReferences(document: unknown): TextValueReferenceUsage[] {
  const opaque = chartOptionScopes(document);
  const usages: TextValueReferenceUsage[] = [];
  visit(textValueScope(document), '');
  return usages;

  function visit(value: unknown, path: string): void {
    if (value && typeof value === 'object' && opaque.has(value)) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}/${index}`));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    if (isTextValueReference(value)) {
      usages.push({ path, reference: value });
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      visit(child, `${path}/${escapePointer(key)}`);
    }
  }
}

/**
 * 页面参数的不变式判定。跑在结构校验之后、文本取值替换之前——
 * 替换会把引用消解掉,之后就没有引用可判了。
 */
export function pageParamErrors(
  declarations: readonly PageParamDeclaration[],
  filterIds: ReadonlySet<string>,
  document: unknown
): TypedError[] {
  const errors: TypedError[] = [];
  const byId = new Map<string, PageParamDeclaration>();

  declarations.forEach((declaration, index) => {
    const path = declaration.path ?? `/params/${index}`;
    if (byId.has(declaration.id)) {
      errors.push(schemaError(`${path}/id`, `页面参数 id 重复:${declaration.id}`));
    }
    byId.set(declaration.id, declaration);
    // 同一语义不得在一个页面里同时以两种形态存在:id 相同是唯一
    // 可判定的形态,两个位置都能影响同一条件时读页面的人无从裁决。
    if (filterIds.has(declaration.id)) {
      errors.push(
        schemaError(
          `${path}/id`,
          `页面参数与筛选器同名:${declaration.id};同一语义只能取一种形态`
        )
      );
    }
    if (declaration.value !== undefined && !matchesParamDeclaration(declaration.value, declaration)) {
      errors.push(schemaError(path, `实际值不符合参数类型 ${declaration.type}`));
    }
    if (declaration.default !== undefined && !matchesParamDeclaration(declaration.default, declaration)) {
      errors.push(
        schemaError(`${path}/default`, `默认值不符合参数类型 ${declaration.type}`)
      );
    }
  });

  errors.push(...tableHeaderParamDeclarationErrors(document,byId));
  const consumed = new Set(tableHeaderParamReferences(document).map(reference => reference.id));
  function queryConsumers(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(queryConsumers); return; }
    const node = value as Record<string, unknown>;
    if (typeof node.param === 'string') consumed.add(node.param);
    Object.values(node).forEach(queryConsumers);
  }
  const raw = document as { sectionGroupParam?: string; dataSources?: Record<string, {source?: {query?: {body?: unknown; paramBindings?: Record<string, unknown>}}}>; filters?: Array<{initialParam?: string}> };
  if (raw.sectionGroupParam) consumed.add(raw.sectionGroupParam);
  for (const source of Object.values(raw.dataSources ?? {})) {
    queryConsumers(source.source?.query?.body);
    for (const id of Object.keys(source.source?.query?.paramBindings ?? {})) consumed.add(id);
  }
  for (const filter of raw.filters ?? []) if (filter.initialParam) consumed.add(filter.initialParam);
  function navigationConsumers(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(navigationConsumers); return; }
    const node = value as Record<string, unknown>;
    if (node.source === 'param' && typeof node.id === 'string') consumed.add(node.id);
    Object.values(node).forEach(navigationConsumers);
  }
  navigationConsumers(textValueScope(document));
  for (const { path, reference } of collectTextValueReferences(document)) {
    const declaration = byId.get(reference.param);
    if (!declaration) {
      errors.push(schemaError(`${path}/param`, `文本取值引用了未声明的页面参数:${reference.param}`));
      continue;
    }
    consumed.add(reference.param);
    if (reference.format !== undefined && !formatSuitsParamType(reference.format, declaration.type)) {
      errors.push(
        schemaError(
          `${path}/format`,
          `格式 ${reference.format} 与页面参数 ${reference.param} 的类型 ${declaration.type} 不相容`
        )
      );
    }
  }

  declarations.forEach((declaration, index) => {
    if (consumed.has(declaration.id)) return;
    errors.push(
      schemaError(
        `${declaration.path ?? `/params/${index}`}/id`,
        `页面参数 ${declaration.id} 没有任何消费者;未被消费的参数通常意味着绑错了位置`
      )
    );
  });

  return errors;
}

export function matchesParamDeclaration(value: unknown, declaration: PageParamDeclaration): value is PageParamValue {
  if (declaration.type === 'timeRange') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const range = value as TimeRangeParamValue;
    const declared = value as TimeRangeParamValue & { granularity?: TimeParamGranularity };
    return Object.keys(value).every(k => k === 'start' || k === 'end' || k === 'granularity') &&
      (declared.granularity === undefined || declared.granularity === declaration.granularity) &&
      matchesTimeValue(range.start, declaration.granularity) && matchesTimeValue(range.end, declaration.granularity) && range.start <= range.end;
  }
  if (declaration.type === 'time') return matchesTimeValue(value, declaration.granularity);
  if (declaration.type !== 'dimension') return typeof value === declaration.type && (typeof value !== 'number' || Number.isFinite(value));
  return declaration.multiple
    ? Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.length > 0) && new Set(value).size === value.length
    : typeof value === 'string' && value.length > 0;
}

function schemaError(path: string, message: string): TypedError {
  return { type: 'SCHEMA_ERROR', path, message };
}

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}
