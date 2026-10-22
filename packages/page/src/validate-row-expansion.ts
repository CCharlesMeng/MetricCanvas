import { ordinaryQuery } from './time-mode';
import type { Page, TableComponent } from './page';
import type { TypedError } from './errors';
import { fieldName, hasQueryFieldMapping } from './field';
import { resolveDataSourceFields } from './data-source';
import { walkPageComponents, flattenPageComponents } from './component-walk';
import { queryResultDependencies } from './query-dependencies';
import { definitionSourceIds } from './data-source-references';
import { computeDependencies } from './compute';
import { rowExpansionColumns, rowExpansionPage, expansionRowKey } from './row-expansion';

const error = (path: string, message: string): TypedError => ({ type: 'SCHEMA_ERROR', path, message });

/** Reuse ordinary table invariants in a projected scope; no second column validator. */
export function rowExpansionErrors(page: Page, validateScope: (page: Page) => TypedError[]): TypedError[] {
  const errors: TypedError[] = [];
  const owners = new Map<string, string>();
  const inputs = new Map<string, string>();
  walkPageComponents(page, (component, componentPath) => {
    if (component.type !== 'table' || !component.props.rowExpansion) return;
    const expansion = component.props.rowExpansion;
    const path = `${componentPath}/props/rowExpansion`;
    const fields = page.dataSources[component.data.main] ? resolveDataSourceFields(page.dataSources[component.data.main]!) : {};
    const key = component.props.rowKey && fields[component.props.rowKey];
    if (!key || key.role !== 'dimension' || !['string', 'number'].includes(key.type)) errors.push(error(`${componentPath}/props/rowKey`, '子表格父表要求稳定的 string/number 维度行键'));
    if (Object.keys(component.data).length !== 1 || component.props.mergeBy) errors.push(error(path, '子表格父表仅支持单一 main 数据槽，不能同时跨行合并'));
    if (componentPath.startsWith('/detailViews/')) errors.push(error(path, '详情浮层内暂不支持行内子表格'));
    if (component.props.toolbar?.export) errors.push(error(path, '子表格导出范围待确认，暂不启用该父表导出'));
    const source = page.dataSources[component.data.main];
    const rows = source?.source.type === 'inline' ? source.source.rows : source?.source.type === 'query' ? source.source.initial?.rows : undefined;
    if (rows && component.props.rowKey) {
      const keys = rows.map(row => expansionRowKey(row[component.props.rowKey!]));
      if (keys.some(key => key === undefined) || new Set(keys).size !== keys.length) errors.push(error(`${componentPath}/props/rowKey`, '父表行键缺失或重复，不能用行序号展开'));
    }
    for (const column of rowExpansionColumns(expansion.table.columns)) {
      if (column.selection || column.link || column.navigate || column.openDetail || column.filterable) errors.push(error(`${path}/table/columns`, '子表格首期只读，仅支持按需搜索和排序，不支持筛选、选择或动作'));
    }
    if (expansion.data.type === 'recordList') {
      if (fields[expansion.data.field]?.type !== 'recordList') errors.push(error(`${path}/data/field`, '子表格必须绑定父行的 recordList/detail 字段'));
      if (expansion.table.pagination?.mode === 'query') errors.push(error(`${path}/table/pagination`, '父行嵌套明细仅支持本地分页'));
    } else {
      const input = expansion.data;
      if (owners.has(input.source)) errors.push(error(`${path}/data/source`, '子表格查询定义必须专属一个展开模板'));
      owners.set(input.source, path);
      const source = page.dataSources[input.source];
      if (source?.source.type !== 'query' || source.source.resultScope === 'complete' || source.compute?.length || queryResultDependencies(source).length) {
        errors.push(error(`${path}/data/source`, '子表格要求普通分页 query，不能使用 complete、compute、结果绑定或组合查询源'));
      }
      if (source?.source.type === 'query') {
        const order = ordinaryQuery(source.source.query).body.dsl_list[0]?.order;
        if (order && typeof order === 'object' && !Array.isArray(order)) {
          const by = order.by;
          if (order.order_by_field !== undefined || (by !== undefined && (!Array.isArray(by) || by.some((rule, index) => !rule || typeof rule !== 'object' || Array.isArray(rule) || typeof rule.field !== 'string' || !['asc', 'desc'].includes(String(rule.type)) || (rule.priority !== undefined && rule.priority !== index + 1))))) errors.push(error(`${path}/data/source`, '子表格默认排序须使用 order.by 的 field/type 有序数组'));
        }
      }
      if (expansion.table.pagination?.mode !== 'query') errors.push(error(`${path}/table/pagination`, '查询子表格必须显式声明 mode:query'));
      if (input.filters.some(id => !input.bindings[id]) || Object.keys(input.bindings).some(id => !input.filters.includes(id))) errors.push(error(`${path}/data/bindings`, '必须且只能绑定子表格声明的全部输入'));
      if (!Object.values(input.bindings).some(binding => binding.source === 'row')) errors.push(error(`${path}/data/bindings`, '查询子表格至少显式绑定一个父行字段'));
      for (const id of input.filters) {
        if (inputs.has(id)) errors.push(error(`${path}/data/filters`, '子表格输入必须专属当前展开模板'));
        inputs.set(id, input.source);
        const declaration = page.filters?.find(filter => filter.id === id);
        if (!declaration || declaration.visible !== false || !['dimension', 'timeRange', 'timePoint'].includes(declaration.type) || (declaration.type === 'dimension' && declaration.hierarchy)) errors.push(error(`${path}/data/filters`, '子表格输入必须引用隐藏的非层级 dimension/timeRange/timePoint 筛选声明'));
        if (source?.source.type === 'query' && !source.source.query.filterBindings?.[id]) errors.push(error(`${path}/data/filters`, '每个子表格输入必须被查询显式消费'));
      }
      for (const binding of Object.values(input.bindings)) {
        if (binding.source === 'row') {
          const field = fields[binding.field];
          if (!field || field.role !== 'dimension' || !['string', 'number', 'date', 'datetime'].includes(field.type)) errors.push(error(`${path}/data/bindings`, '父行输入必须绑定已声明的标量维度字段'));
        } else if (binding.source === 'filter') {
          if (!page.filters?.some(filter => filter.id === binding.id) || input.filters.includes(binding.id)) errors.push(error(`${path}/data/bindings`, '来源筛选不存在或引用了子表格私有输入'));
        } else if (!page.params?.some(param => param.id === binding.id)) errors.push(error(`${path}/data/bindings`, '来源页面参数不存在'));
      }
    }
    try {
      const scope = rowExpansionPage(page, component);
      const childFields = resolveDataSourceFields(scope.page.dataSources[scope.table.data.main]!);
      const childKey = childFields[expansion.table.rowKey];
      if (!childKey || childKey.role !== 'dimension' || !['string', 'number'].includes(childKey.type)) errors.push(error(`${path}/table/rowKey`, '子表格要求稳定的 string/number 维度行键'));
      if (expansion.data.type === 'query') {
        for (const id of [expansion.table.rowKey, ...rowExpansionColumns(expansion.table.columns).filter(column => column.sortable).map(column => fieldName(column.field))]) {
          if (!scope.page.dataSources[scope.table.data.main]?.fields[id] || !hasQueryFieldMapping(scope.page.dataSources[scope.table.data.main]!.fields[id]!)) errors.push(error(`${path}/table/columns`, '查询子表格行键与排序字段必须具有 queryField 映射'));
        }
      }
      for (const issue of validateScope(scope.page)) errors.push({ ...issue, path: issue.path.startsWith('/sections/0/components/0/props') ? issue.path.replace('/sections/0/components/0/props', `${path}/table`) : `${path}${issue.path}` });
    } catch { /* The precise source/field error is already reported above. */ }
  });
  const components = flattenPageComponents(page);
  for (const component of components) {
    const input = component.type === 'table' ? component.props.rowExpansion?.data : undefined;
    if (input?.type === 'query' && Object.values(input.bindings).some(binding => binding.source === 'filter' && inputs.has(binding.id))) errors.push(error('/filters', '子表格绑定不得读取其他实例的私有输入'));
  }
  for (const [id, owner] of owners) {
    if (components.some(component => Object.values(component.data ?? {}).includes(id))) errors.push(error(owner, '子表格查询定义不能同时被正文或详情视图消费'));
    for (const [sourceId, source] of Object.entries(page.dataSources)) {
      if (sourceId !== id && [...computeDependencies(source.compute ?? []), ...queryResultDependencies(source), ...definitionSourceIds(source)].includes(id)) errors.push(error(owner, '子表格查询定义不能被其他数据源依赖'));
    }
  }
  for (const [id, owner] of inputs) {
    for (const [sourceId, source] of Object.entries(page.dataSources)) {
      if (sourceId !== owner && source.source.type === 'query' && source.source.query.filterBindings?.[id]) errors.push(error('/filters', '子表格私有输入不能被其他查询消费'));
    }
    if (components.some(component => component.type === 'table' && rowExpansionColumns(component.props.columns).some(column => column.selection?.writes[id]))) errors.push(error('/filters', '正文不能写入子表格私有输入'));
    if (components.some(component => 'actions' in component.props && component.props.actions?.some(action => 'writeFilter' in action && action.writeFilter === id))) errors.push(error('/filters', '正文不能写入子表格私有输入'));
  }
  if (owners.size || components.some(component => component.type === 'table' && component.props.rowExpansion)) {
    if (components.some(component => component.type === 'reportHeader' && component.props.exportButtons?.length)) errors.push(error('/sections', '子表格页面导出范围待确认，暂不启用页面导出'));
  }
  return errors;
}
