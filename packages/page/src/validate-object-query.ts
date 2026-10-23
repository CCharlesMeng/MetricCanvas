import { dqeRecord, isObjectDqeItem, objectOutputFields } from './dqe-object';
import type { DqeQueryDefinition, JsonObject } from './query';
import type { TypedError } from './errors';

const issue = (path: string, message: string): TypedError => ({ type: 'SCHEMA_ERROR', path, message });
export function objectQueryErrors(query: DqeQueryDefinition, path: string): TypedError[] {
  const item = query.body!.dsl_list[0];
  if (!isObjectDqeItem(item)) return metricShapeErrors(query,item,path);
  const errors = objectShapeErrors(item, `${path}/body/dsl_list/0`);
  for (const [id, binding] of Object.entries(query.filterBindings ?? {})) {
    if (binding.target === 'time' && (!binding.queryField || !binding.valueFormat)) errors.push(issue(`${path}/filterBindings/${id}`, 'object 时间绑定必须显式声明 queryField 和 valueFormat'));
  }
  return errors;
}
function objectShapeErrors(item: JsonObject, path: string): TypedError[] {
  const errors: TypedError[] = [];
  if (typeof item.object_type !== 'string' || !item.object_type.trim()) errors.push(issue(`${path}/object_type`, 'object 查询必须声明 object_type'));
  const fields = objectOutputFields(item);
  if (!Array.isArray(item.output_fields) || !fields.length || fields.length !== item.output_fields.length || fields.some(field => !field.trim()) || new Set(fields).size !== fields.length) errors.push(issue(`${path}/output_fields`, 'output_fields 必须是非空、不重复的字段名称数组'));
  if (item.output_dims !== undefined || item.output_metrics !== undefined) errors.push(issue(path, 'object 不得混用 output_dims/output_metrics'));
  errors.push(...objectFilterErrors(item,path));
  return errors;
}
function objectFilterErrors(item: JsonObject, path: string): TypedError[] {
  const errors: TypedError[]=[];
  const filter=dqeRecord(item.filter);
  if(item.filter!==undefined && (typeof item.filter!=='object'||item.filter===null||Array.isArray(item.filter))) errors.push(issue(`${path}/filter`,'object filter 必须是对象'));
  if (filter.dims !== undefined || filter.metrics !== undefined || filter.time !== undefined) errors.push(issue(`${path}/filter`, 'object 条件必须使用 filter.fields'));
  if (filter.fields !== undefined && !Array.isArray(filter.fields)) errors.push(issue(`${path}/filter/fields`, 'object filter.fields 必须是数组'));
  if (Array.isArray(filter.fields)) filter.fields.forEach((value, index) => errors.push(...objectConditionErrors(value, `${path}/filter/fields/${index}`)));
  return errors;
}
function objectConditionErrors(value: unknown, path: string): TypedError[] {
  const field = dqeRecord(value);
  if (typeof field.field_name !== 'string' || !field.field_name.trim()) return [issue(path, 'object 条件必须声明 field_name')];
  const parameter = dqeRecord(field.value_list);
  if (!Array.isArray(field.value_list) && typeof parameter.param !== 'string') return [issue(path, 'object 条件必须声明 value_list 数组或受控参数引用')];
  if (field.operator !== undefined && (typeof field.operator !== 'string' || !field.operator.trim())) return [issue(path, 'object 条件 operator 必须是非空字符串')];
  return [];
}

function metricShapeErrors(query: DqeQueryDefinition, item: JsonObject, path: string): TypedError[] {
  const errors: TypedError[]=[];
  if(item.output_fields!==undefined)errors.push(issue(path,'output_fields 必须使用 query_type:object'));
  for(const binding of Object.values(query.filterBindings??{})){
    if(binding.target==='time' && (binding.queryField!==undefined || binding.valueFormat!==undefined))errors.push(issue(path,'普通 DQE 时间绑定不声明 object 字段或格式'));
  }
  return errors;
}
