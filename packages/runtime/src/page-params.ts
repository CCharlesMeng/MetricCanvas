import type { PageParamDeclaration, PageParamValue } from '@metriccanvas/page';

/** 普通查询参数按接收页面的声明解释，URL 层仅编码一次。 */
export type PageParamValues = ReadonlyMap<string, PageParamValue>;

export interface PageParamState {
  values: PageParamValues;
  /** 声明为必需、URL 未提供且无默认值的参数 id;页面因此无法呈现。 */
  missing: string[];
}

export function resolvePageParams(
  search: string,
  declarations: readonly PageParamDeclaration[]
): PageParamState {
  const query = new URLSearchParams(stripQuestionMark(search));
  const values = new Map<string, PageParamValue>();
  const missing: string[] = [];

  for (const declaration of declarations) {
    const parsed = parseParamValue(query.get(declaration.id), declaration);
    const value = parsed ?? declaration.default;
    if (value !== undefined) {
      values.set(declaration.id, value);
    } else if (declaration.required) {
      missing.push(declaration.id);
    }
  }
  return { values, missing };
}

/** 目标页的参数查询串;跨页下钻 由它编码。 */
export function pageParamSearch(values: PageParamValues): string {
  const query = new URLSearchParams();
  for (const [id, value] of values) {
    query.set(id, serializePageParam(value));
  }
  return query.toString();
}

export function serializePageParam(value: PageParamValue): string {
  return String(value);
}

function parseParamValue(
  raw: string | null,
  declaration: PageParamDeclaration
): PageParamValue | undefined {
  if (raw === null) return undefined;
  const text = raw;
  if (declaration.type === 'string') return text === '' ? undefined : text;
  if (declaration.type === 'number') {
    const numeric = Number(text);
    return text.trim() !== '' && Number.isFinite(numeric) ? numeric : undefined;
  }
  if (text === 'true') return true;
  if (text === 'false') return false;
  return undefined;
}

function stripQuestionMark(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search;
}
