import type { PageParamDeclaration, PageParamValue } from '@metriccanvas/page';

/**
 * 页面参数的 URL 编解码(ADR-0047)。
 *
 * 参数不可变:一次页面打开解析一次即可,因此不进筛选状态,也没有写入口。
 * 值前缀 `p:` 与筛选状态的 `d:` / `t:` 并列,占用同一个查询串但互不识别——
 * `FilterState.fromURL` 认不出 `p:` 会原样忽略,`mergedSearch` 只删除筛选器
 * 自己的键,参数因此不会被筛选变更抹掉。
 */

export const PAGE_PARAM_PREFIX = 'p:';

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

/** 目标页的参数查询串;跨页下钻的 `setParams` 由它编码。 */
export function pageParamSearch(values: PageParamValues): string {
  const query = new URLSearchParams();
  for (const [id, value] of values) {
    query.set(id, serializePageParam(value));
  }
  return query.toString();
}

export function serializePageParam(value: PageParamValue): string {
  return `${PAGE_PARAM_PREFIX}${encodeURIComponent(String(value))}`;
}

function parseParamValue(
  raw: string | null,
  declaration: PageParamDeclaration
): PageParamValue | undefined {
  if (raw === null || !raw.startsWith(PAGE_PARAM_PREFIX)) return undefined;
  let text: string;
  try {
    text = decodeURIComponent(raw.slice(PAGE_PARAM_PREFIX.length));
  } catch {
    // 畸形百分号序列按未提供处理(解析永不 throw)。
    return undefined;
  }
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
