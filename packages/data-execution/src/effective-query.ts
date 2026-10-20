import {selectTimeQuery,requiresTimeValidation,timeFilterBoundaryError} from '@metriccanvas/page/internal';
import { numberRangeIssue,rangeContextIssue,selectedCase, dimensionSelectionIssue, bindingQueryField, hasQueryFieldMapping, timePointPredicateValue, resolveTimeWindow, type FilterDeclaration, type QueryDataSource, type EffectiveQuery, type DataSnapshot } from '@metriccanvas/page/internal';
import type { FilterValues } from './filter-values';
import type { DataGateway, QueryDiagnosticContext } from './ports';
import { preservedQueryError } from './query-error';
import { rawSnapshot } from './snapshots';

export type QueryHeaderFilters = import('@metriccanvas/page/internal').TableHeaderFilters;

export interface QueryBinding { now?:Date; filters?: readonly FilterDeclaration[]; dataSource: QueryDataSource; pagination?: { limit: number }; }

function mappedQueryField(
  dataSource: QueryDataSource,
  fieldId: string
): string | undefined {
  const field = dataSource.fields[fieldId];
  return field && hasQueryFieldMapping(field) ? field.queryField : undefined;
}

export function composeEffectiveQuery(
  binding: QueryBinding,
  values: FilterValues,
  pageIndex: number,
  sortRules: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>,
  headerFilters: QueryHeaderFilters,
  search?: { fields: readonly string[]; query: string }
): EffectiveQuery {
  const bindingFilters=binding.filters,now=binding.now;
  const dataSource = binding.dataSource;
  const query = selectTimeQuery(dataSource.source.query,values);
  const filterValues: EffectiveQuery['filterValues'] = [];
  for (const [filterId, binding] of Object.entries(query.filterBindings ?? {})) {
    const value = values.get(filterId);
    const declaration = bindingFilters?.find(filter => filter.id === filterId);
    if(declaration&&(declaration.type==='timeRange'||declaration.type==='timePoint')&&requiresTimeValidation(declaration)&&value&&(value.type==='timeRange'||value.type==='timePoint')&&timeFilterBoundaryError(declaration,value,now))throw Object.assign(new Error('日期或时间模式不符合声明'),{code:'DQE_QUERY_REJECTED'});
    if(declaration?.type==='timeRange'&&declaration.display==='modes'&&value?.type!=='timeRange')throw Object.assign(new Error('模式范围必须选择'),{code:'DQE_QUERY_REJECTED'});
    if(declaration?.type==='dimension' && dimensionSelectionIssue(declaration,value?.type==='dimension'?value.values:[]))throw Object.assign(new Error('筛选值不符合已声明选择规则'),{code:'DQE_QUERY_REJECTED'});
    if(declaration?.type==='numberRange'&&((value?.type==='numberRange'&&numberRangeIssue(declaration,value))||rangeContextIssue(declaration,values)))throw Object.assign(new Error('金额范围或币种不符合声明'),{code:'DQE_QUERY_REJECTED'});
    if(value?.type==='dimension'&&!value.values.length)continue;
    if (value?.type === 'dimension' && declaration?.type === 'dimension' && declaration.selection?.mode === 'multiple' && declaration.selection.allBehavior === 'unrestricted' && declaration.options) {
      const enabled=declaration.options.filter(option=>!option.disabled);
      if(enabled.length && enabled.length===value.values.length && enabled.every(option=>value.values.includes(option.value)))continue;
    }
    const metric=binding.target==='numberRange'?(binding.metricByFilter?selectedCase(binding.metricByFilter.cases,values.get(binding.metricByFilter.filterId)?.type==='dimension'?(values.get(binding.metricByFilter.filterId) as {values:string[]}).values:undefined):binding.metric):undefined;
    if(binding.target==='numberRange'&&!metric)throw Object.assign(new Error('金额metric未配置'),{code:'DQE_CONFIG_ERROR'});
    if (binding.target === 'dimension' && value?.type === 'dimension') {
      // 层级维度取当前层级的谓词字段(ADR-0084);缺级时整条不下推,
      // 不拿别的层级字段去接收本层取值。
      const queryField = bindingQueryField(binding, value.level);
      if (queryField !== undefined) {
        filterValues.push({
          target: 'dimension',
          queryField,
          values: value.values
        });
      }
    } else if (binding.target === 'time' && value?.type === 'timeRange') {
      filterValues.push({
        target: 'time',
        value: { from: value.from, to: value.to }
      });
    } else if (binding.target === 'time' && binding.window && value?.type === 'timePoint') {
      const range = resolveTimeWindow(value.value, binding.window);
      filterValues.push({ target: 'time', value: { from: range.start, to: range.end } });
    } else if (binding.target === 'timePoint' && value?.type === 'timePoint') {
      // 时间点是等值谓词,按绑定声明的格式落到维度字段上(ADR-0085)。
      filterValues.push({
        target: 'dimension',
        queryField: binding.queryField,
        values: [timePointPredicateValue(value.value, binding.valueFormat)]
      });
    } else if (binding.target === 'boolean' && value?.type === 'boolean') {
      // 勾选与否不对称:不勾且未声明 whenFalse 即无条件,不由运行时取反。
      const values = value.value ? binding.whenTrue : binding.whenFalse;
      if (values !== undefined) {
        filterValues.push({
          target: 'dimension',
          queryField: binding.queryField,
          values: [...values]
        });
      }
    } else if (binding.target === 'numberRange' && value?.type === 'numberRange') {
      if (value.from !== undefined || value.to !== undefined) {
        filterValues.push({
          target: 'metricRange',
          metric: metric!,
          ...(value.from !== undefined ? { from: value.from } : {}),
          ...(value.to !== undefined ? { to: value.to } : {})
        });
      }
    }
  }
  // 表头筛选按列字段落到维度谓词上(ADR-0086)。字段没有 queryField 映射
  // 说明它不是上游取来的列,整条跳过而不是拿字段 id 冒充查询字段。
  for (const [fieldId, filter] of Object.entries(headerFilters)) {
    const queryField = mappedQueryField(dataSource, fieldId);
    if (queryField === undefined) continue;
    if (filter.mode === 'select') {
      if (filter.values.length > 0) {
        filterValues.push({ target: 'dimension', queryField, values: [...filter.values] });
      }
    } else if (filter.mode === 'numberRange') {
      if (filter.from !== undefined || filter.to !== undefined) filterValues.push({ target: 'metricRange', metric: queryField, ...(filter.from === undefined ? {} : { from: filter.from }), ...(filter.to === undefined ? {} : { to: filter.to }) });
    } else if (filter.from.length > 0 || filter.to.length > 0) {
      filterValues.push({
        target: 'dimensionRange',
        queryField,
        ...(filter.from.length > 0 ? { from: filter.from } : {}),
        ...(filter.to.length > 0 ? { to: filter.to } : {})
      });
    }
  }
  const sort = sortRules.flatMap((rule) => {
    const queryField = mappedQueryField(dataSource, rule.field);
    return queryField === undefined ? [] : [{ queryField, direction: rule.direction }];
  });
  const term = search?.query.trim();
  const queryFields = search?.fields.map(field => mappedQueryField(dataSource, field));
  if (term && (!queryFields?.length || queryFields.some(field => field === undefined))) {
    throw new Error('表格搜索字段缺少查询字段映射');
  }
  // language 与查询体按数据源的查询定义分支原样透传,编排层不合成协议细节。
  return {
    language: query.language,
    body: query.body,
    fieldMappings: dataSource.fields,
    ...(term && queryFields ? { search: { queryFields: queryFields as string[], query: term } } : {}),
    ...(sort.length > 0 ? { sort } : {}),
    ...(binding.pagination
      ? {
          pagination: {
            offset: pageIndex * binding.pagination.limit,
            limit: binding.pagination.limit
          }
        }
      : {}),
    filterValues
  };
}

export async function executeQuery(
  query: EffectiveQuery,
  gateway: DataGateway,
  diagnosticContext: QueryDiagnosticContext,
  signal?: AbortSignal
): Promise<DataSnapshot> {
  try {
    const result = await gateway.fetchData(query, diagnosticContext, signal);
    if (query.pagination && result.totalCount === undefined) {
      throw Object.assign(new Error('查询分页结果缺少 totalCount'), { code:'DQE_ROW_CONTRACT_ERROR' });
    }
    return rawSnapshot(result.rows, result.totalCount);
  } catch (cause) {
    return { status: 'error', error: preservedQueryError(cause) };
  }
}
