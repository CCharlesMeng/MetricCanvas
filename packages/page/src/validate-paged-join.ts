import {ordinaryQuery} from './time-mode';
import {queryFilterIds} from './amount-filter';
import {fieldName} from './field';
import type { Page } from './page';
import type { TypedError } from './errors';
import { walkPageComponents } from './component-walk';
import { hasQueryFieldMapping } from './field';
import { queryResultFieldContract, validateContractRows } from './result-field-contract';

export function pagedJoinErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const error = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  const ptr = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');
  for (const [id, data] of Object.entries(page.dataSources)) {
    if (data.source.type !== 'pagedJoin') continue;
    const source = data.source, path = `/dataSources/${ptr(id)}`;
    const domain = source.members[source.domainMember];
    const key = data.fields[source.rowKey];
    if (!domain) error(`${path}/source/domainMember`, '业务行域成员不存在');
    if (!key || key.role !== 'dimension' || !['string', 'number'].includes(key.type) || key.nullable !== false) error(`${path}/source/rowKey`, '行键必须是非空 string/number 维度');
    const bindings = new Set<string>();
    const queryParams=(query:unknown):Set<string>=>{
      const ids=new Set<string>();function visit(value:unknown){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){const node=value as Record<string,unknown>;if(typeof node.param==='string')ids.add(node.param);Object.values(node).forEach(visit);}}
      visit(query);const declarations=(query as {paramBindings?:Record<string,unknown>})?.paramBindings;Object.keys(declarations??{}).forEach(id=>ids.add(id));return ids;
    };
    const params=new Set<string>();
    for (const member of Object.values(source.members)) {
      const ref = page.dataSources[member.source];
      if (ref?.source.type === 'query') { queryFilterIds(ref.source.query).forEach(id => bindings.add(id));queryParams(ref.source.query).forEach(id=>params.add(id)); }
    }
    for (const [name, member] of Object.entries(source.members)) {
      const mp = `${path}/source/members/${ptr(name)}`;
      const ref = page.dataSources[member.source];
      if (!ref || ref.source.type !== 'query') { error(`${mp}/source`, '成员必须引用普通查询源'); continue; }
      const order = ordinaryQuery(ref.source.query).body.dsl_list[0]?.order;
      if (ref.compute?.length || ref.source.query.resultBindings?.length || ref.source.resultScope !== 'complete' ||
        (order && typeof order === 'object' && ('limit' in order || 'offset' in order))) error(`${mp}/source`, '成员必须无计算、无结果绑定、无业务窗口且声明完整');
      const field = ref.fields[member.key.field];
      if (!field || field.role !== 'dimension' || field.type !== key?.type || field.nullable !== false || !hasQueryFieldMapping(field)) error(`${mp}/key/field`, '成员键必须与业务行键类型一致且非空');
      if (!member.key.queryField.trim()) error(`${mp}/key/queryField`, '编码输入目标不能为空');
      for(const param of params)if(!queryParams(ref.source.query).has(param))error(`${mp}/source`,'每个成员必须显式消费全部组合查询参数');
      for (const filter of bindings) if (!ref.source.query.filterBindings?.[filter]) error(`${mp}/source`, '每个成员必须显式消费全部组合业务筛选');
    }
    const keyProjection = source.projection[source.rowKey];
    if (!domain || keyProjection?.member !== source.domainMember || keyProjection?.field !== domain.key.field) error(`${path}/source/projection/${ptr(source.rowKey)}`, '行键投影必须来自业务行域成员键');
    for (const [fieldId, field] of Object.entries(data.fields)) {
      if ('queryField' in field) error(`${path}/fields/${ptr(fieldId)}`, '组合字段不得声明 queryField');
      if (fieldId === source.ordinalField) {
        if (field.type !== 'number' || field.role !== 'measure' || field.nullable !== false || source.projection[fieldId] || fieldId === source.rowKey) error(`${path}/source/ordinalField`, '序号必须为无投影的非空数值度量');
        continue;
      }
      const projection = source.projection[fieldId];
      const member = projection && source.members[projection.member];
      const input = member && page.dataSources[member.source]?.fields[projection.field];
      if (!input || !hasQueryFieldMapping(input)) { error(`${path}/source/projection/${ptr(fieldId)}`, '投影必须引用成员的原始字段'); continue; }
      if (input.type !== field.type || input.role !== field.role || ('unit' in input ? input.unit : undefined) !== ('unit' in field ? field.unit : undefined) ||
        (field.type === 'money' && (input.type !== 'money' || input.currency !== field.currency))) error(`${path}/fields/${ptr(fieldId)}`, '投影类型、角色、单位和币种必须相容');
      if ((projection.member !== source.domainMember || input.nullable !== false) && field.nullable === false) error(`${path}/fields/${ptr(fieldId)}`, '可能缺匹配的投影必须允许 null');
    }
    for (const fieldId of Object.keys(source.projection)) if (!data.fields[fieldId]) error(`${path}/source/projection/${ptr(fieldId)}`, '投影产出字段未声明');
    if (source.ordinalField && !data.fields[source.ordinalField]) error(`${path}/source/ordinalField`, '序号字段未声明');
    if (new Set(source.ordering.default.map(rule=>rule.field)).size!==source.ordering.default.length)error(`${path}/source/ordering/default`,'默认排序字段不得重复');
    for (const field of [...source.ordering.sortableFields, ...source.ordering.default.map(rule => rule.field)]) {
      if (!source.projection[field] || !['string', 'number', 'money', 'date', 'datetime'].includes(data.fields[field]?.type) || field === source.ordinalField) error(`${path}/source/ordering`, '排序必须引用可比较的投影字段');
    }
    if (new Set(source.ordering.sortableFields).size !== source.ordering.sortableFields.length) error(`${path}/source/ordering/sortableFields`, '排序字段不得重复');
    let consumers = 0;
    walkPageComponents(page, (component, cp) => {
      if (!Object.values(component.data ?? {}).includes(id) && !(component.type === 'aiSummary' && Object.values(component.props.relatedData).some(v => v.source === id))) return;
      consumers++;
      if (component.type !== 'table' || component.data.main !== id || component.props.pagination?.mode !== 'query' || Object.keys(component.data).length !== 1) error(cp, '组合源只允许单槽查询分页表消费');
      if (component.type === 'table') {
        if (component.props.rowKey !== source.rowKey) error(`${cp}/props/rowKey`, '表格行键必须使用组合业务行键');
        const visit = (columns: typeof component.props.columns) => columns.forEach(col => {
          if (col.kind === 'group') return visit(col.children);
          const field = fieldName(col.field);
          if (col.sortable && !source.ordering.sortableFields.includes(field)) error(`${cp}/props/columns`, '交互排序字段必须在组合排序声明中');
        });
        visit(component.props.columns);
      }
    });
    if (consumers !== 1) error(path, '组合源必须由一张查询分页表独占');
    const initial = source.initial;
    if (initial) {
      if (initial.view.search?.match === 'equals' && initial.view.search.fields.length !== 1) error(`${path}/source/initial/view/search`, '等值搜索只允许一个字段');
      if (initial.view.pageIndex !== 0 || initial.view.pageSize !== source.pagination.pageSize || JSON.stringify(initial.view.sort) !== JSON.stringify(source.ordering.default) || initial.view.predicates.length || initial.view.search?.query.trim()) error(`${path}/source/initial/view`, '组合初始行必须匹配默认视图');
      const fields = Object.fromEntries(Object.entries(data.fields).map(([id, field]) => [id, queryResultFieldContract(field)]));
      if (initial.rows.length !== Math.min(initial.totalCount, source.pagination.pageSize) || !validateContractRows(initial.rows, fields).ok) error(`${path}/source/initial/rows`, '组合初始行必须符合最终字段契约及完整第一页');
      const keys = initial.rows.map(row => row[source.rowKey]);
      if (keys.some(v => v == null || (typeof v === 'string' && !v.trim())) || new Set(keys).size !== keys.length) error(`${path}/source/initial/rows`, '组合初始行键必须唯一非空');
    }
  }
  return errors;
}
