import type { TypedError } from './errors';
import { pageParamDeclarations, type GroupedPageParams, type PageParamDeclaration } from './page-param';
import type { PageQuery } from './query';

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function pointer(value: string): string { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }

/** 查询中的参数引用只允许出现在维度值列表和成对的时间端点。 */
export function queryParamReferenceErrors(document: unknown): TypedError[] {
  const page = document as {params?: GroupedPageParams | PageParamDeclaration[]; dataSources: Record<string, {source: {type: string; query?: PageQuery}}>};
  if (!page.params || Array.isArray(page.params)) return [];
  if (!page.params || Array.isArray(page.params)) return [];
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
      if (Object.values(query.filterBindings ?? {}).some(b => b.target === 'dimension' && b.queryField === dim?.dim_name) ||
          Object.values(query.paramBindings ?? {}).some(b => b.target === 'dimension' && b.queryField === dim?.dim_name)) error(path, '同一维度不能同时由原位引用和筛选/旧参数绑定控制');
      if (dims.some((other, i) => i !== index && record(other)?.dim_name === dim?.dim_name)) error(path, '原位参数目标不能另有同维度条件');
    });
    const time = record(filter?.time);
    const start = record(time?.start), end = record(time?.end);
    if ((start && 'param' in start) || (end && 'param' in end)) {
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
  return !!record(record(filter?.time)?.start)?.param ||
    (Array.isArray(filter?.dims) && filter.dims.some(d => !!record(record(d)?.dim_value_list)?.param));
}
