import type { DqeQueryDefinition, DqeFilterBinding, DqeRequestBody, JsonObject, JsonValue } from './query';

export type ObjectTimeFormat = 'iso' | 'compact' | 'datetime';
export interface ObjectTimeTarget { queryField?: string; valueFormat?: ObjectTimeFormat }

export function isObjectDqeItem(item: unknown): item is JsonObject & { query_type: 'object' } {
  return !!item && typeof item === 'object' && 'query_type' in item && item.query_type === 'object';
}
export function objectOutputFields(item: JsonObject): string[] {
  return Array.isArray(item.output_fields) ? item.output_fields.filter((field): field is string => typeof field === 'string') : [];
}
export function dqeRecord(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
/** Project field predicates only for shared ownership/parameter checks; never change the saved DSL. */
export function dqeDimensionConditions(item: JsonObject): JsonObject[] {
  const filter = dqeRecord(item.filter);
  if (!isObjectDqeItem(item)) return Array.isArray(filter.dims) ? filter.dims.map(dqeRecord) : [];
  return Array.isArray(filter.fields) ? filter.fields.map(value => {
    const field = dqeRecord(value);
    return { ...field, dim_name: field.field_name, dim_value_list: field.value_list };
  }) : [];
}
export function setObjectFieldValues(item: JsonObject, field: string, values: JsonValue, operator = '='): void {
  const filter = dqeRecord(item.filter);
  const fields = Array.isArray(filter.fields) ? filter.fields.filter(value => dqeRecord(value).field_name !== field) : [];
  const added=Array.isArray(values)&&!values.length?[]:[{field_name:field,value_list:values,operator}];
  item.filter = { ...filter, fields: [...fields, ...added] };
}
/** Explicit datetime format means second precision in the source's calendar; no timezone conversion. */
export function objectDateBoundary(value: string, end: boolean, format: ObjectTimeFormat): string {
  if (format === 'iso') return value;
  if (format === 'compact') return value.replaceAll('-', '');
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(value)) throw new Error('object 时间绑定需要规范日期或月份');
  const date = value.length === 7 ? value + (end ? `-${new Date(Date.UTC(Number(value.slice(0,4)), Number(value.slice(5,7)), 0)).getUTCDate()}` : '-01') : value;
  return `${date} ${end ? '23:59:59' : '00:00:00'}`;
}
export function setObjectTimeRange(item: JsonObject, target: ObjectTimeTarget, from: string, to: string): void {
  if (!target.queryField || !target.valueFormat) throw new Error('object 时间绑定必须声明 queryField 和 valueFormat');
  const filter = dqeRecord(item.filter);
  const fields = Array.isArray(filter.fields) ? filter.fields.filter(value => dqeRecord(value).field_name !== target.queryField) : [];
  item.filter = { ...filter, fields: [...fields,
    { field_name: target.queryField, value_list: [objectDateBoundary(from, false, target.valueFormat)], operator: '>=' },
    { field_name: target.queryField, value_list: [objectDateBoundary(to, true, target.valueFormat)], operator: '<=' }
  ] };
}
export function dqeDefaultSort(item: JsonObject): Array<{ queryField: string; direction: 'asc' | 'desc' }> {
  const order = dqeRecord(item.order);
  if (order.by !== undefined || order.orderByField !== undefined) throw new Error('DQE 不支持 order.by/orderByField；请使用 order_by_field/type 单字段排序');
  if (order.order_by_field === undefined && order.type === undefined) return [];
  if (typeof order.order_by_field !== 'string' || !order.order_by_field.trim()) throw new Error('DQE 默认排序字段无效');
  const direction = typeof order.type === 'string' ? order.type.toLowerCase() : undefined;
  if (direction !== 'asc' && direction !== 'desc') throw new Error('DQE 默认排序方向无效');
  return [{ queryField: order.order_by_field, direction }];
}

/** An explicitly bound field belongs to page state even when the control is cleared. */
export function bindingOwnedDqeBody(query: DqeQueryDefinition): DqeRequestBody {
  const body=query.body!,item=body.dsl_list[0];
  if(!isObjectDqeItem(item) || !query.filterBindings)return body;
  const owned=new Set(Object.values(query.filterBindings).flatMap(objectBindingFields));
  const filter=dqeRecord(item.filter),fields=Array.isArray(filter.fields)?filter.fields:[];
  return {dsl_list:[{...item,filter:{...filter,fields:fields.filter(field=>!owned.has(String(dqeRecord(field).field_name)))}}]};
}
function objectBindingFields(binding: DqeFilterBinding): string[] {
  if(binding.target==='dimension')return 'queryField' in binding?[binding.queryField]:Object.values(binding.levelQueryFields);
  if(binding.target==='numberRange')return binding.metricByFilter?Object.values(binding.metricByFilter.cases):binding.metric?[binding.metric]:[];
  return binding.queryField?[binding.queryField]:[];
}
