import { hasQueryFieldMapping, type Page, type PagedJoinDataSource, type QueryDataSource, type TableQueryView } from '@metriccanvas/page/internal';
import type { FilterValues } from '../filter-values';
import { composeEffectiveQuery } from '../effective-query';

export type PagedJoinPlan = { page: Page; sourceId: string; source: PagedJoinDataSource; conditions: FilterValues;
  view: TableQueryView; strategy:'selectPageThenFill'|'completeJoin'; reason:'single-owner'|'multiple-owners'|'capability-or-field-contract'|'search'|'predicate-target-conflict'; selection?: string; members: Map<string, QueryDataSource> };
/** Dynamic execution order stays private; resultBindings are never rewritten. */
export function compilePagedJoin(page: Page, sourceId: string, conditions: FilterValues, input: TableQueryView): PagedJoinPlan {
  const source = page.dataSources[sourceId] as PagedJoinDataSource;
  const view = structuredClone(input);
  if (!view.sort.length) view.sort = structuredClone(source.source.ordering.default);
  if(view.pageSize>1000)throw Object.assign(new Error('组合查询窗口超过 1000 行'),{code:'DQE_QUERY_REJECTED'});
  if (view.sort.some(rule => ![...source.source.ordering.sortableFields,...source.source.ordering.default.map(rule=>rule.field)].includes(rule.field))) throw Object.assign(new Error('未声明的全局排序字段'), { code: 'DQE_QUERY_REJECTED' });
  if (view.predicates.some(p => !source.source.projection[p.field])) throw Object.assign(new Error('未声明的组合筛选字段'), { code: 'DQE_QUERY_REJECTED' });
  if(view.predicates.some(predicate=>{const field=source.fields[predicate.field];return predicate.op==='gte'||predicate.op==='lte'?field.role!=='measure'||!['number','money'].includes(field.type):field.role!=='dimension';}))throw Object.assign(new Error('组合筛选与最终字段类型不相容'),{code:'DQE_QUERY_REJECTED'});
  if (view.search?.fields.some(field => !source.source.projection[field] || source.fields[field]?.type !== 'string')) throw Object.assign(new Error('组合搜索字段必须为已投影文本'), { code: 'DQE_QUERY_REJECTED' });
  const members = new Map(Object.entries(source.source.members).map(([id, member]) => [id, page.dataSources[member.source] as QueryDataSource]));
  const owners = new Set(view.sort.map(rule => source.source.projection[rule.field]?.member));
  let selection = owners.size === 1 ? [...owners][0] : undefined;
  let reason:PagedJoinPlan['reason']=selection?'single-owner':'multiple-owners';
  if (selection) {
    const member = source.source.members[selection], definition = members.get(selection)!;
    const fields = [...view.sort.map(r => r.field), ...view.predicates.map(p => p.field)];
    if (!member.canSelectPage || view.search?.query.trim() || fields.some(field => {
      const projection = source.source.projection[field];
      const raw = projection && definition.fields[projection.field];
      return projection?.member !== selection || !raw || !hasQueryFieldMapping(raw) || (view.sort.some(r => r.field === field) && raw.nullable !== false);
    })) { selection = undefined; reason=planSearchReason(view); }
    else {
      const query = composeEffectiveQuery({ dataSource: definition }, conditions, 0, [], {});
      const item = definition.source.query.body.dsl_list[0];
      // Existing predicates cannot be replaced by table-local predicates.
      const filter = item.filter as { dims?: Array<{ dim_name?: string }>; metrics?: Array<{ metric_name?: string }> } | undefined;
      const controlled = new Set(view.predicates.map(p => {
        const field = definition.fields[source.source.projection[p.field].field];
        return hasQueryFieldMapping(field) ? field.queryField : '';
      }));
      if (query.filterValues.some(v => v.target === 'dimension' ? controlled.has(v.queryField) : v.target === 'metricRange' ? controlled.has(v.metric) : false) ||
        filter?.dims?.some(v => controlled.has(v.dim_name ?? '')) || filter?.metrics?.some(v => controlled.has(v.metric_name ?? ''))) {selection = undefined;reason='predicate-target-conflict';}
    }
  }
  return { page, sourceId, source, conditions, view, selection, members, strategy:selection?'selectPageThenFill':'completeJoin',reason };
}

function planSearchReason(view:TableQueryView):PagedJoinPlan['reason'] {return view.search?.query.trim()?'search':'capability-or-field-contract';}
