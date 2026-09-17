import type { TypedError } from './errors';
import { isValueFormatPreset, type ValueFormatPreset } from './field';
import { matchesTimeValue, type TimeParamGranularity } from './time-param';

/**
 * 页面参数(ADR-0047):页面打开时由 URL 确定、此后不可改变的具名输入。
 * 与筛选器按可变性分界——页面打开后还能被控件、组件 action 或跨页下钻
 * 改变的是筛选器,不能改变的是页面参数,换一个取值意味着打开另一个页面实例。
 */

export type PageParamType = 'string' | 'number' | 'boolean' | 'dimension' | 'time' | 'timeRange';
export interface TimeRangeParamValue { start: string; end: string; granularity: TimeParamGranularity; }
export type PageParamValue = string | number | boolean | string[] | TimeRangeParamValue;

export interface PageParamDeclaration {
  id: string;
  type: PageParamType;
  required?: boolean;
  /** 仅维度参数支持多值；缺省单值。 */
  multiple?: boolean;
  granularity?: TimeParamGranularity;
  label?: string;
  default?: Exclude<PageParamValue, TimeRangeParamValue>;
  /** Filled inputs are persisted only on an instantiated page, never on a template. */
  value?: PageParamValue;
}

/**
 * 文本取值引用:对一个页面参数的整值替换,可携带展示格式。
 * 它不是模板插值——引用处放的就是参数值本身,不参与任何字符串拼接。
 */
export interface TextValueReference {
  param: string;
  format?: ValueFormatPreset;
}

/** 文本取值:字面量,或对页面参数的整值引用。 */
export type TextValue = string | TextValueReference;

/**
 * 文本取值引用按形状识别。页面协议里没有第二个使用 `param` 键的对象,
 * 因此不需要维护一张按位置枚举的白名单——ADR-0047 的规则本就落在位置上。
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
  'number-1',
  'number-2',
  'number-grouped',
  'compact-wan-0',
  'compact-wan-1',
  'compact-yi-1',
  'cny-adaptive',
  'percent-0',
  'percent-1',
  'percent-2',
  'percent-2-signed'
]);

/** 日历语义的格式预设:参数值是日历字符串时才有意义。 */
const DATE_FORMATS = new Set<ValueFormatPreset>(['date', 'date-month-day']);

export function formatSuitsParamType(
  format: ValueFormatPreset,
  type: PageParamType
): boolean {
  if (type === 'timeRange') return false;
  if (NUMERIC_FORMATS.has(format)) return type === 'number';
  if (DATE_FORMATS.has(format)) return type === 'string';
  return true;
}

/** 文档中每一处文本取值引用及其 JSON Pointer 位置。 */
export interface TextValueReferenceUsage {
  path: string;
  reference: TextValueReference;
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
  const usages: TextValueReferenceUsage[] = [];
  visit(textValueScope(document), '');
  return usages;

  function visit(value: unknown, path: string): void {
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
    const path = `/params/${index}`;
    if ((document as {schemaVersion?:string}).schemaVersion !== '6.5' && declaration.required === undefined) errors.push(schemaError(`${path}/required`, '旧版本必须显式声明required'));
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
    if (declaration.default !== undefined && declaration.value !== undefined) {
      errors.push(schemaError(`${path}/value`, 'value 与 default 互斥'));
    }
    if (declaration.default !== undefined && !matchesParamDeclaration(declaration.default, declaration)) {
      errors.push(
        schemaError(`${path}/default`, `默认值不符合参数类型 ${declaration.type}`)
      );
    }
    if (declaration.value !== undefined && !matchesParamDeclaration(declaration.value, declaration)) {
      errors.push(schemaError(`${path}/value`, `实际值不符合参数类型 ${declaration.type}`));
    }
  });

  const consumed = new Set<string>();
  const raw = document as { dataSources?: Record<string, {source?: {query?: {paramBindings?: Record<string, unknown>; body?: { dsl_list?: Array<{ filter?: unknown }> }}}}>; filters?: Array<{initialParam?: string}> };
  for (const source of Object.values(raw.dataSources ?? {})) for (const id of Object.keys(source.source?.query?.paramBindings ?? {})) consumed.add(id);
  for (const source of Object.values(raw.dataSources ?? {})) {
    const filter = source.source?.query?.body?.dsl_list?.[0]?.filter;
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) continue;
    const node = filter as Record<string, unknown>;
    if (Array.isArray(node.dims)) for (const dim of node.dims) {
      const reference = dim && typeof dim === 'object' && !Array.isArray(dim) ? (dim as Record<string, unknown>).dim_value_list : undefined;
      if (isInlineReference(reference)) consumed.add(reference.param);
    }
    const time = node.time;
    if (time && typeof time === 'object' && !Array.isArray(time)) for (const part of ['start', 'end']) {
      const reference = (time as Record<string, unknown>)[part];
      if (isInlineReference(reference)) consumed.add(reference.param);
    }
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
        `/params/${index}/id`,
        `页面参数 ${declaration.id} 没有任何消费者;未被消费的参数通常意味着绑错了位置`
      )
    );
  });

  return errors;
}

export function matchesParamDeclaration(value: unknown, declaration: PageParamDeclaration): value is PageParamValue {
  if (declaration.type === 'time') return matchesTimeValue(value, declaration.granularity);
  if (declaration.type === 'timeRange') {
    return typeof value === 'object' && value !== null && !Array.isArray(value) &&
      Object.keys(value).length === 3 && Object.keys(value).every(k => ['start','end','granularity'].includes(k)) &&
      (value as TimeRangeParamValue).granularity === declaration.granularity &&
      matchesTimeValue((value as TimeRangeParamValue).start, declaration.granularity) &&
      matchesTimeValue((value as TimeRangeParamValue).end, declaration.granularity) &&
      (value as TimeRangeParamValue).start <= (value as TimeRangeParamValue).end;
  }
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

function isInlineReference(value: unknown): value is { param: string } {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    typeof (value as { param?: unknown }).param === 'string';
}
