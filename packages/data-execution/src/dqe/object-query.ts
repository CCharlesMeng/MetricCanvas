import { dqeRecord, objectDateBoundary, isObjectDqeItem, setObjectFieldValues, setObjectTimeRange, dqeDefaultSort, type EffectiveQuery, type JsonObject } from '@metriccanvas/page/internal';
import { EmptyTableQuery } from './table-filters';

type Sort = NonNullable<EffectiveQuery['sort']>;
export type ObjectSortEncoder = (item: JsonObject, sort: Sort) => JsonObject;
const configError = (message: string) => Object.assign(new Error(message), { code: 'DQE_CONFIG_ERROR' });

/** Object predicates use the same resolved page values, encoded only at the protocol boundary. */
export function encodeObjectQuery(query: EffectiveQuery, encodeSort?: ObjectSortEncoder): JsonObject {
  let item = structuredClone(query.body.dsl_list[0]);
  if (!isObjectDqeItem(item)) throw configError('object 编码要求 query_type:object');
  for (const predicate of query.bindingValues ?? query.filterValues) applyBinding(item, predicate);
  for (const predicate of query.tableFilters ?? []) appendPredicate(item, formattedTablePredicate(query,predicate));
  if (query.search?.match === 'equals') {
    if (query.search.queryFields.length !== 1) throw configError('等值搜索只允许一个查询字段');
    appendField(item, query.search.queryFields[0], [query.search.query], '=');
  }
  if (query.pagination) item.order = { ...dqeRecord(item.order), ...query.pagination };
  if (query.sort?.length) item = encodeObjectSort(item, query.sort, encodeSort);
  else if (dqeRecord(item.order).by !== undefined) item = encodeObjectSort(item, dqeDefaultSort(item), encodeSort);
  return item;
}
export function encodeObjectSort(item: JsonObject, sort: Sort, encoder?: ObjectSortEncoder): JsonObject {
  if (sort.length > 1) {
    if (!encoder) throw configError('object 多字段排序需要经过真实服务验证的 encodeObjectSort 适配');
    return encoder(item, structuredClone(sort));
  }
  const order = { ...dqeRecord(item.order) };
  delete order.by; delete order.order_by_field; delete order.type;
  if (sort[0]) { order.order_by_field = sort[0].queryField; order.type = sort[0].direction; }
  return { ...item, order };
}
function applyBinding(item: JsonObject, predicate: EffectiveQuery['filterValues'][number]): void {
  if (predicate.target === 'time') { setObjectTimeRange(item, predicate, predicate.value.from, predicate.value.to); return; }
  const name = predicate.target === 'metricRange' ? predicate.metric : predicate.queryField;
  if (predicate.target === 'dimension') { setObjectFieldValues(item, name, predicate.values); return; }
  removeField(item, name);
  appendRange(item, name, predicate.from, predicate.to);
}
function appendPredicate(item: JsonObject, predicate: EffectiveQuery['filterValues'][number]): void {
  if (predicate.target === 'time') throw configError('表头日期条件必须声明查询字段');
  if (predicate.target === 'dimension') {
    if (!predicate.values.length) throw new EmptyTableQuery();
    appendField(item, predicate.queryField, predicate.values, '='); return;
  }
  appendRange(item, predicate.target === 'metricRange' ? predicate.metric : predicate.queryField, predicate.from, predicate.to);
}
function appendRange(item: JsonObject, name: string, from: string | number | undefined, to: string | number | undefined): void {
  if (from !== undefined) appendField(item, name, [from], '>=');
  if (to !== undefined) appendField(item, name, [to], '<=');
}
function removeField(item: JsonObject, name: string): void {
  const filter = dqeRecord(item.filter);
  item.filter = { ...filter, fields: fields(item).filter(field => dqeRecord(field).field_name !== name) };
}
function fields(item: JsonObject) {
  const value = dqeRecord(item.filter).fields;
  if (value !== undefined && !Array.isArray(value)) throw configError('object filter.fields 必须是数组');
  return Array.isArray(value) ? value : [];
}
function appendField(item: JsonObject, name: string, values: Array<string | number>, operator: string): void {
  item.filter = { ...dqeRecord(item.filter), fields: [...fields(item), { field_name: name, value_list: values, operator }] };
}

function formattedTablePredicate(query: EffectiveQuery, predicate: EffectiveQuery['filterValues'][number]): EffectiveQuery['filterValues'][number] {
  if(predicate.target!=='dimensionRange')return predicate;
  const time=query.filterValues.find((value):value is Extract<EffectiveQuery['filterValues'][number],{target:'time'}>=>value.target==='time'&&value.queryField===predicate.queryField);
  if(!time?.valueFormat)return predicate;
  return {...predicate,from:predicate.from===undefined?undefined:objectDateBoundary(predicate.from,false,time.valueFormat),to:predicate.to===undefined?undefined:objectDateBoundary(predicate.to,true,time.valueFormat)};
}
