import type { TypedError } from './errors';
import type { PageParamDeclaration } from './page-param';
import type { FilterDeclaration } from './filter';
import type { DqeQueryDefinition } from './query';

/** 结构校验后的参数绑定不变量；不从字段名猜目标，不解释任意表达式。 */
export function paramBindingErrors(document: unknown): TypedError[] {
  const page = document as { params?: PageParamDeclaration[]; filters?: FilterDeclaration[]; dataSources: Record<string, {source: {type: string; query?: DqeQueryDefinition}}> };
  const params = new Map((page.params ?? []).map(p => [p.id, p]));
  const filters = new Map((page.filters ?? []).map(f => [f.id, f]));
  const errors: TypedError[] = [];
  const error = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  const filterConsumers = new Set<string>();
  for (const [sourceId, source] of Object.entries(page.dataSources)) {
    const query = source.source.query;
    if (source.source.type !== 'query' || !query) continue;
    const owners = new Map<string, string>();
    for (const [id, binding] of Object.entries(query.paramBindings ?? {})) {
      const path = `/dataSources/${pointer(sourceId)}/source/query/paramBindings/${pointer(id)}`;
      if (params.get(id)?.type !== 'dimension') error(path, '查询参数绑定必须引用已声明的dimension参数');
      if (owners.has(binding.queryField)) error(path, '同一查询目标只能有一个参数来源');
      owners.set(binding.queryField, id);
      const filter = query.body.dsl_list[0].filter;
      if (filter && typeof filter === 'object' && !Array.isArray(filter) && Array.isArray(filter.dims) && filter.dims.some(d => d && typeof d === 'object' && !Array.isArray(d) && d.dim_name === binding.queryField)) {
        error(path, '参数绑定目标不得另有查询体默认条件');
      }
      const matching = Object.entries(query.filterBindings ?? {}).filter(([, f]) => f.target === 'dimension' && f.queryField === binding.queryField);
      if (matching.length > 1) error(path, '参数绑定目标不得由多个筛选器控制');
      for (const [filterId] of matching) {
        const declaration = filters.get(filterId);
        if (declaration?.type !== 'dimension' || declaration.initialParam !== id) error(path, '查询与筛选必须引用同一参数初值来源');
        else filterConsumers.add(filterId);
      }
    }
    for (const [filterId, binding] of Object.entries(query.filterBindings ?? {})) {
      const declaration = filters.get(filterId);
      if (declaration?.type === 'dimension' && declaration.initialParam &&
          (binding.target !== 'dimension' || owners.get(binding.queryField) !== declaration.initialParam)) {
        error(`/dataSources/${pointer(sourceId)}/source/query/filterBindings/${pointer(filterId)}`, '参数初始化筛选的每个查询目标都必须显式绑定同一参数');
      }
    }
  }
  (page.filters ?? []).forEach((filter, index) => {
    if (filter.type !== 'dimension' || filter.initialParam === undefined) return;
    const path = `/filters/${index}/initialParam`;
    if (params.get(filter.initialParam)?.type !== 'dimension') error(path, '筛选初值必须引用已声明的dimension参数');
    if (filter.default !== undefined) error(path, '参数初始化与筛选default互斥，默认来源只能声明一次');
    if (filter.hierarchy) error(path, '第一版参数初始化只支持平面维度筛选');
    if (!filterConsumers.has(filter.id)) error(path, '参数初始化筛选必须具有匹配的显式查询目标');
  });
  return errors;
}
function pointer(s: string): string { return s.replaceAll('~', '~0').replaceAll('/', '~1'); }
