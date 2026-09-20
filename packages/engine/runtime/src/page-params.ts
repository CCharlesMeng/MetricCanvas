import { initializeQueryParams, matchesParamDeclaration, materializePageParams, type PageParamDeclaration, type PageParamValue } from '@metriccanvas/page/internal';

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
    if (declaration.path) {
      // 分组参数的保存值就是实际值。显式非法 URL 输入不回退到另一份报告。
      let value: unknown = declaration.value;
      if (query.has(declaration.id)) {
        const entries = query.getAll(declaration.id);
        if (declaration.type === 'dimension') value = entries;
        else if (entries.length !== 1) value = undefined;
        else if (declaration.type === 'timeRange') {
          try { value = JSON.parse(entries[0]); } catch { value = undefined; }
        } else value = parseParamValue(entries[0], declaration);
      }
      if (matchesParamDeclaration(value, declaration)) values.set(declaration.id, value);
      else if (value !== undefined || query.has(declaration.id) || declaration.required) missing.push(declaration.id);
      continue;
    }

    if (declaration.value !== undefined || declaration.type === 'timeRange') {
      const value = declaration.value;
      if (value !== undefined && matchesParamDeclaration(value, declaration)) values.set(declaration.id, structuredClone(value));
      else if (value !== undefined || declaration.required !== false) missing.push(declaration.id);
      continue;
    }
    if (declaration.type === 'time') {
      // 显式非法输入不回退默认月份，防止展示了另一统计期却看似成功。
      const value = query.has(declaration.id) ? query.get(declaration.id) : declaration.default;
      if (query.getAll(declaration.id).length > 1 || (value !== undefined && !matchesParamDeclaration(value, declaration))) {
        missing.push(declaration.id);
      } else if (value !== undefined) {
        values.set(declaration.id, value);
      } else if (declaration.required !== false) {
        missing.push(declaration.id);
      }
      continue;
    }
    const parsed = declaration.type === 'dimension' && declaration.multiple
      ? query.has(declaration.id) ? query.getAll(declaration.id) : undefined
      : declaration.type === 'dimension' && query.getAll(declaration.id).length > 1 ? undefined
      : parseParamValue(query.get(declaration.id), declaration);
    const valid = matchesParamDeclaration(parsed, declaration) ? parsed : undefined;
    const value = valid ?? declaration.default;
    if (value !== undefined) {
      values.set(declaration.id, value);
    } else if (declaration.required !== false) {
      missing.push(declaration.id);
    }
  }
  return { values, missing };
}

/** 目标页的参数查询串;跨页下钻 由它编码。 */
export function pageParamSearch(values: PageParamValues): string {
  const query = new URLSearchParams();
  for (const [id, value] of values) {
    if (Array.isArray(value)) for (const item of value) query.append(id, item);
    else query.set(id, serializePageParam(value));
  }
  return query.toString();
}

export function serializePageParam(value: PageParamValue): string {
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value.granularity !== undefined) throw new Error('旧timeRange参数仍通过程序通道传递');
    return JSON.stringify(value);
  }
  return String(value);
}

function parseParamValue(
  raw: string | null,
  declaration: PageParamDeclaration
): PageParamValue | undefined {
  if (raw === null) return undefined;
  const text = raw;
  if (declaration.type === 'string' || declaration.type === 'dimension') return text === '' ? undefined : text;
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

/** 运行态副本：参数只写入未受筛选控制的查询目标及筛选初值，模板不变。 */
export function initializePageParams(page: import('@metriccanvas/page').Page, values: PageParamValues): import('@metriccanvas/page').Page {
  // 6.5 inline values are resolved once at the Page boundary.  In particular,
  // a missing template value never reaches the gateway as an object or as an
  // accidentally unfiltered query.
  const materialized = ['6.5', '6.6'].includes(page.schemaVersion);
  if (materialized) {
    page = materializePageParams(page, values);
  }
  for (const declaration of page.params ?? []) {
    const value = values.get(declaration.id);
    if ((value === undefined && declaration.required !== false) || (value !== undefined && !matchesParamDeclaration(value, declaration))) throw new Error(`参数取值缺失或类型错误:${declaration.id}`);
  }
  const initialized = structuredClone(page);
  for (const declaration of initialized.filters ?? []) {
    if (declaration.type !== 'dimension' || !declaration.initialParam) continue;
    const value = values.get(declaration.initialParam);
    declaration.default = value === undefined ? [] : Array.isArray(value) ? [...value] : [String(value)];
  }
  for (const source of Object.values(initialized.dataSources)) {
    if (source.source.type === 'query') {
      if (Object.values(source.source.query.paramBindings ?? {}).some(binding => binding.target === 'time')) {
        // 内嵌行没有当前参数的执行凭据；已核验的执行回执另由 execution 接管。
        delete source.source.initial;
      }
      if (!materialized) source.source.query = initializeQueryParams(source.source.query, values);
    }
  }
  return initialized;
}
