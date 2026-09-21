import type { TypedError } from './errors';
import { pageParamDeclarations, type GroupedPageParams, type PageParamDeclaration, type PageParamValue } from './page-param';
import { bindingQueryFields, type PageQuery } from './query';
import { timeWindowZ } from './schema/data-source';
import { resolveTimeWindow, timeWindowCompatible, type TimeWindow } from './time-param';

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function pointer(value: string): string { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }

/** 查询中的参数引用只允许出现在维度值列表和 filter.time（整段引用或成对端点）。 */
export function queryParamReferenceErrors(document: unknown): TypedError[] {
  const page = document as {params?: GroupedPageParams | PageParamDeclaration[]; dataSources: Record<string, {source: {type: string; query?: PageQuery}}>};
  const declarations = new Map(pageParamDeclarations(page.params).map(p => [p.id, p]));
  const errors: TypedError[] = [];
  const error = (path: string, message: string) => errors.push({type: 'SCHEMA_ERROR', path, message});
  for (const [sourceId, source] of Object.entries(page.dataSources)) {
    const query = source.source.query;
    if (source.source.type !== 'query' || !query) continue;
    const root = `/dataSources/${pointer(sourceId)}/source/query/body`;
    const allowed = new Set<string>();
    const filter = record(query.body.dsl_list[0].filter);
    const filterPath = `${root}/dsl_list/0/filter`;
    const dims = Array.isArray(filter?.dims) ? filter.dims : [];
    dims.forEach((raw, index) => {
      const dim = record(raw);
      const ref = record(dim?.dim_value_list);
      if (!ref || !('param' in ref)) return;
      const path = `${filterPath}/dims/${index}/dim_value_list`;
      allowed.add(path);
      const p = declarations.get(String(ref.param));
      if (Object.keys(ref).length !== 1 || typeof ref.param !== 'string') error(path, '维度引用只能声明 param');
      if (p?.type !== 'dimension' || !p.required || !p.dimName) error(path, '原位维度引用必须使用必需的分组维度参数');
      if (p?.dimName !== dim?.dim_name) error(path, '维度参数 dim_name 必须与查询目标一致');
      if (Object.values(query.filterBindings ?? {}).some(b => bindingQueryFields(b).includes(String(dim?.dim_name))) ||
          Object.values(query.paramBindings ?? {}).some(b => b.target === 'dimension' && b.queryField === dim?.dim_name)) error(path, '同一维度不能同时由原位引用和筛选/旧参数绑定控制');
      if (dims.some((other, i) => i !== index && record(other)?.dim_name === dim?.dim_name)) error(path, '原位参数目标不能另有同维度条件');
    });
    const time = record(filter?.time);
    const start = record(time?.start), end = record(time?.end);
    if (typeof time?.param === 'string') {
      // 时间引用:参数值原样用;声明 window 时以参数值为基准点派生区间,
      // 派生规则因此留在文档里,不必在创作层把日历算术再算一遍。
      const path = `${filterPath}/time`;
      allowed.add(path);
      const p = declarations.get(time.param);
      if (Object.keys(time).some(key => !['period', 'is_aggregate', 'param', 'window'].includes(key))) error(path, '时间引用不得与查询体起止并存');
      if (p?.type !== 'timeRange' || !p.required) error(path, '时间引用必须指向必需的 times 参数');
      if (time.period !== (p?.granularity === 'month' ? 'month' : 'day')) error(path, '查询 period 与时间参数精度不兼容');
      if (time.window !== undefined) {
        const window = timeWindowZ.safeParse(time.window);
        // 未填值模板没有起止可判,基准点是否单点留到取值代入时再判。
        if (!window.success) error(`${path}/window`, '时间窗口不是合法的具名窗口');
        else if (p?.granularity && !timeWindowCompatible(p.granularity, window.data)) error(`${path}/window`, '时间窗口单位与参数精度不相容');
        else if (isRange(p?.value) && p.value.start !== p.value.end) error(`${path}/window`, '窗口派生要求基准时间参数为单点');
      }
      if (Object.values(query.filterBindings ?? {}).some(b => b.target === 'time') || Object.values(query.paramBindings ?? {}).some(b => b.target === 'time')) error(path, '时间原位引用不能与筛选/旧参数绑定共同控制');
    } else if ((start && 'param' in start) || (end && 'param' in end)) {
      const path = `${filterPath}/time`;
      for (const part of ['start', 'end'] as const) {
        allowed.add(`${path}/${part}`);
        const ref = record(time?.[part]);
        if (!ref || Object.keys(ref).length !== 2 || typeof ref.param !== 'string' || ref.part !== part) error(`${path}/${part}`, '时间端点必须为 {param, part}，part 与端点一致');
      }
      const p = declarations.get(String(start?.param));
      if (!start || !end || start.param !== end.param) error(path, '同一查询起止必须引用同一个时间参数');
      if (p?.type !== 'timeRange' || !p.required) error(path, '时间端点必须引用必需的 times 参数');
      if (time?.period !== (p?.granularity === 'month' ? 'month' : 'day')) error(path, '查询 period 与时间参数精度不兼容');
      if (Object.values(query.filterBindings ?? {}).some(b => b.target === 'time') || Object.values(query.paramBindings ?? {}).some(b => b.target === 'time')) error(path, '时间原位引用不能与筛选/旧参数绑定共同控制');
    }
    function visit(value: unknown, path: string): void {
      if (Array.isArray(value)) { value.forEach((v, i) => visit(v, `${path}/${i}`)); return; }
      const node = record(value);
      if (!node) return;
      if ('param' in node && !allowed.has(path)) error(path, '此查询位置不允许页面参数引用');
      for (const [key, child] of Object.entries(node)) visit(child, `${path}/${pointer(key)}`);
    }
    visit(query.body, root);
    if (allowed.size && (!page.params || Array.isArray(page.params))) error(root, '原位引用需要 6.6 分组参数声明');
  }
  return errors;
}

export function hasQueryParamReferences(query: PageQuery): boolean {
  const filter = record(query.body.dsl_list[0].filter);
  const time = record(filter?.time);
  return typeof time?.param === 'string' || !!record(time?.start)?.param ||
    (Array.isArray(filter?.dims) && filter.dims.some(d => !!record(record(d)?.dim_value_list)?.param));
}

function isRange(value: unknown): value is { start: string; end: string } {
  const range = record(value);
  return typeof range?.start === 'string' && typeof range.end === 'string';
}

/** 调用前须通过页面校验；只改查询副本，查询粒度、聚合设置和指标保持原样。 */
export function resolveQueryParamReferences(query: PageQuery, values: ReadonlyMap<string, PageParamValue>): void {
  const filter = record(query.body.dsl_list[0].filter);
  if (!filter) return;
  if (Array.isArray(filter.dims)) for (const raw of filter.dims) {
    const dim = record(raw), ref = record(dim?.dim_value_list);
    if (!dim || !ref || typeof ref.param !== 'string') continue;
    const value = values.get(ref.param);
    if (!Array.isArray(value)) throw new Error(`维度参数缺失或类型错误:${ref.param}`);
    dim.dim_value_list = [...value];
  }
  const time = record(filter.time);
  if (!time) return;
  if (typeof time.param === 'string') {
    const value = record(values.get(time.param));
    if (typeof value?.start !== 'string' || typeof value?.end !== 'string') throw new Error(`时间参数缺失或类型错误:${time.param}`);
    const window = time.window as TimeWindow | undefined;
    if (window && value.start !== value.end) throw new Error(`窗口派生要求基准时间参数为单点:${time.param}`);
    const range = window ? resolveTimeWindow(value.end, window) : { start: value.start, end: value.end };
    delete time.param;
    delete time.window;
    time.start = range.start;
    time.end = range.end;
    return;
  }
  for (const part of ['start', 'end'] as const) {
    const ref = record(time[part]);
    if (!ref || typeof ref.param !== 'string') continue;
    const value = record(values.get(ref.param));
    if (typeof value?.[part] !== 'string') throw new Error(`时间参数缺失或类型错误:${ref.param}`);
    time[part] = value[part];
  }
}
