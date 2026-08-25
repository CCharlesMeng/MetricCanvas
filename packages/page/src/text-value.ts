import type { ValueFormatPreset } from './field';
import {
  isTextValueReference,
  textValueScope,
  type PageParamDeclaration,
  type PageParamValue
} from './page-param';

/**
 * 文本取值的整值替换(ADR-0047)。
 *
 * 引用解析为参数值的展示文本;引用的参数没有取值时,该属性视为未声明——
 * 对象属性被删除,数组中的该项被移除,而不是留下空字符串或空洞。
 *
 * 展示格式化由调用方注入:格式预设的闭集属于页面协议(`field.ts`),
 * 它的呈现实现属于纯渲染层。缺省实现只做字面量转字符串,校验期够用。
 */

export type TextValueFormatter = (
  value: PageParamValue,
  format?: ValueFormatPreset
) => string;

export interface TextValueResolution {
  /** 参数 id → 取值;缺席表示该参数在本次打开时没有取值。 */
  values: ReadonlyMap<string, PageParamValue>;
  format?: TextValueFormatter;
}

/** 属性视为未声明的内部标记。 */
const ABSENT = Symbol('absent-text-value');

/**
 * 只替换 `textValueScope` 圈定的声明部分;`dataSources` 原样带回。
 */
export function resolveTextValues(
  document: unknown,
  resolution: TextValueResolution
): unknown {
  const format = resolution.format ?? defaultFormatter;
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    return document;
  }
  const source = document as Record<string, unknown>;
  const resolved = visit(textValueScope(source)) as Record<string, unknown>;
  return Object.hasOwn(source, 'dataSources')
    ? { ...resolved, dataSources: source.dataSources }
    : resolved;

  function visit(value: unknown): unknown | typeof ABSENT {
    if (Array.isArray(value)) {
      return value.map(visit).filter((item) => item !== ABSENT);
    }
    if (typeof value !== 'object' || value === null) return value;
    if (isTextValueReference(value)) {
      const resolvedValue = resolution.values.get(value.param);
      return resolvedValue === undefined ? ABSENT : format(resolvedValue, value.format);
    }
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const item = visit(child);
      if (item !== ABSENT) next[key] = item;
    }
    return next;
  }
}

/**
 * 校验期代入:没有真实 URL 输入时,必需参数代入默认值或占位符,
 * 可选参数按缺席处理。这样「必填文本属性引用了可选参数」会在替换后的
 * 结构复检里直接暴露,不需要为每个文本位置维护一张必填性表。
 */
export function validationResolution(
  declarations: readonly PageParamDeclaration[]
): TextValueResolution {
  const values = new Map<string, PageParamValue>();
  for (const declaration of declarations) {
    if (!declaration.required) continue;
    values.set(declaration.id, declaration.default ?? placeholderFor(declaration));
  }
  return { values };
}

function placeholderFor(declaration: PageParamDeclaration): PageParamValue {
  if (declaration.type === 'number') return 0;
  if (declaration.type === 'boolean') return false;
  return declaration.label ?? declaration.id;
}

function defaultFormatter(value: PageParamValue): string {
  return String(value);
}
