import { headerDeclarations } from './header-binding';
import { chartOptionScopes } from './chart-option';
import type { ValueFormatPreset } from './field';
import { isFilterTextValueReference } from './filter-text-value';
import {
  isTextValueReference,
  isTextValueComposition,
  textValueScope,
  type PageParamDeclaration,
  type PageParamValue,
  type FilterTextValueReference
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
  /** 已应用筛选值；缺席只用于解析占位，运行时按原引用持续投影。 */
  filterValues?: ReadonlyMap<string, PageParamValue>;
  format?: TextValueFormatter;
  /** 仅呈现投影使用：输入不可用时显示占位，不把占位值带入查询。 */
  missingParams?: ReadonlySet<string>;
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
  return resolveTexts(document, resolution, false);
}

/** 编译运行时筛选引用前先解析参数，保持被移除的可选数组项与引用路径一致。 */
export function resolveParamTextValues(document: unknown, resolution: TextValueResolution): unknown {
  return resolveTexts(document, resolution, true);
}

function resolveTexts(document: unknown, resolution: TextValueResolution, preserveFilters: boolean): unknown {
  const format = resolution.format ?? defaultFormatter;
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    return document;
  }
  const opaque = chartOptionScopes(document);
  const source = document as Record<string, unknown>;
  const resolved = visit(textValueScope(source)) as Record<string, unknown>;
  normalizeHeaderIdentities(source,resolved);

  return Object.hasOwn(source, 'dataSources')
    ? { ...resolved, dataSources: source.dataSources }
    : resolved;

  function visit(value: unknown): unknown | typeof ABSENT {
    if (value && typeof value === 'object' && opaque.has(value)) return value;
    if (Array.isArray(value)) {
      return value.map(visit).filter((item) => item !== ABSENT);
    }
    if (typeof value !== 'object' || value === null) return value;
    if (isTextValueReference(value)) {
      const resolvedValue = resolution.values.get(value.param);
      if (resolvedValue !== undefined) return format(resolvedValue, value.format);
      return resolution.missingParams?.has(value.param) ? '—' : ABSENT;
    }
    if (isFilterTextValueReference(value)) {
      return preserveFilters ? value : resolveFilterTextValue(value, resolution);
    }
    if (isTextValueComposition(value)) {
      return composition(value.parts);
    }
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const item = visit(child);
      if (item !== ABSENT) next[key] = item;
    }
    return next;
  }

  function composition(input: readonly unknown[]): unknown | typeof ABSENT {
    const parts = input.map(visit);
    // 可选参数继续使整个属性缺席；缺失必需输入只在呈现投影中使用占位。
    if (parts.includes(ABSENT)) return ABSENT;
    if (preserveFilters && parts.some(isFilterTextValueReference)) return { parts };
    return parts.join('');
  }
}

export function resolveFilterTextValue(reference: FilterTextValueReference, resolution: TextValueResolution): string {
  const selected = resolution.filterValues?.get(reference.filter);
  return selected === undefined ? (reference.format === 'period' ? '全部期间' : '—') :
    (resolution.format ?? defaultFormatter)(selected, reference.format);
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
    if (declaration.required === false) continue;
    values.set(declaration.id, declaration.value ?? declaration.default ?? placeholderFor(declaration));
  }
  return { values };
}

function placeholderFor(declaration: PageParamDeclaration): PageParamValue {
  if (declaration.type === 'time') return declaration.granularity === 'month' ? '2000-01' : '2000-01-01';
  if (declaration.type === 'timeRange') {
    const unit = declaration.granularity === 'month' ? '2000-01' : '2000-01-01';
    return { start: unit, end: unit, granularity: declaration.granularity ?? 'date' };
  }
  if (declaration.type === 'number') return 0;
  if (declaration.type === 'boolean') return false;
  return declaration.label ?? declaration.id;
}

export function formatPeriod(value: string | { start: string; end: string }): string {
  return typeof value === 'string' ? value : value.start === value.end ? value.start : `${value.start} 至 ${value.end}`;
}

function defaultFormatter(value: PageParamValue): string {
  if (typeof value === 'object' && !Array.isArray(value)) return formatPeriod(value);
  if (Array.isArray(value)) return value.join('、');
  return String(value);
}

function normalizeHeaderIdentities(source:unknown,resolved:unknown):void {
  const originals=new Map(headerDeclarations(source).map(header=>[header.path,header.props]));
  for(const header of headerDeclarations(resolved))normalizeHeaderIdentity(header.props,originals.get(header.path));
}
function normalizeHeaderIdentity(header:Record<string,unknown>,original?:Record<string,unknown>):void {
  const identity=header.identity as Record<string,unknown>|undefined;
  if(!identity)return;
  const originalIdentity=original?.identity as Record<string,unknown>|undefined;
  if(originalIdentity?.title!==undefined&&!identity.title)identity.title='未命名';
  const code=identity.code as {label?:unknown;value?:unknown}|undefined;
  if(code&&(!code.value||!code.label))delete identity.code;
  const description=identity.description as {text?:unknown}|undefined;
  if(description&&!description.text)delete identity.description;
  for(const key of ['tags','facts'])normalizeIdentityItems(identity,key);
}
function normalizeIdentityItems(identity:Record<string,unknown>,key:string):void {
  const items=identity[key] as Array<Record<string,unknown>>|undefined;
  if(!items)return;
  const filtered=items.filter(item=>key==='tags'?item.text:item.value&&item.label);
  if(filtered.length)identity[key]=filtered;else delete identity[key];
}
