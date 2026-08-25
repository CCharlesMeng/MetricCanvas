import type { TypedError } from './errors';
import { isValueFormatPreset, type ValueFormatPreset } from './field';

/**
 * 页面参数(ADR-0047):页面打开时由 URL 确定、此后不可改变的具名输入。
 * 与筛选器按可变性分界——页面打开后还能被控件、组件 action 或跨页下钻
 * 改变的是筛选器,不能改变的是页面参数,换一个取值意味着打开另一个页面实例。
 */

export type PageParamType = 'string' | 'number' | 'boolean';
export type PageParamValue = string | number | boolean;

export interface PageParamDeclaration {
  id: string;
  type: PageParamType;
  required: boolean;
  label?: string;
  default?: PageParamValue;
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
    if (declaration.default !== undefined && !matchesParamType(declaration.default, declaration.type)) {
      errors.push(
        schemaError(`${path}/default`, `默认值不符合参数类型 ${declaration.type}`)
      );
    }
  });

  const consumed = new Set<string>();
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

function matchesParamType(value: PageParamValue, type: PageParamType): boolean {
  return typeof value === type;
}

function schemaError(path: string, message: string): TypedError {
  return { type: 'SCHEMA_ERROR', path, message };
}

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}
