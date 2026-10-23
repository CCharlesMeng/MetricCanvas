import {timeWindowZ} from './schema/data-source';
import {resolveTimeWindow,timeWindowCompatible,type TimeWindow} from './time-param';
import { dqeRecord, objectDateBoundary, type ObjectTimeFormat } from './dqe-object';
import type { JsonObject, PageQuery } from './query';
import { bindingQueryFields } from './query';
import type { PageParamDeclaration, PageParamValue } from './page-param';
import type { TypedError } from './errors';

const issue = (path: string, message: string): TypedError => ({ type: 'SCHEMA_ERROR', path, message });
export function objectParamReferenceErrors(query: PageQuery, declarations: ReadonlyMap<string, PageParamDeclaration>, root: string, outsideLayer: (p: PageParamDeclaration | undefined) => boolean, layered: boolean): TypedError[] {
  const errors: TypedError[] = [], allowed = new Set<string>();
  const fields = objectConditions(query.body!.dsl_list[0]);
  fields.forEach((field, index) => {
    const ref = dqeRecord(field.value_list);
    if (!Object.hasOwn(ref, 'param')) return;
    const path = `${root}/dsl_list/0/filter/fields/${index}/value_list`;
    allowed.add(path);
    const declaration = declarations.get(String(ref.param));
    if (outsideLayer(declaration)) errors.push(issue(path, 'object 参数引用必须位于 params.query'));
    if (declaration?.type === 'dimension') errors.push(...dimensionReferenceErrors(field, ref, declaration, fields, path));
    else errors.push(...timeReferenceErrors(field, ref, declaration, fields, path));
    if (controlledField(query, String(field.field_name))) errors.push(issue(path, '同一 object 字段不能同时由参数引用和绑定控制'));
  });
  visitReferences(query.body, root, allowed, errors);
  if(allowed.size && !layered)errors.push(issue(root,'原位引用需要 6.6 分组参数声明'));
  if (allowed.size && Object.keys(query.paramBindings ?? {}).length) errors.push(issue(root, '同一查询不得混用原位引用和paramBindings'));
  return errors;
}
function dimensionReferenceErrors(field: JsonObject, ref: JsonObject, declaration: PageParamDeclaration, fields: JsonObject[], path: string): TypedError[] {
  const errors: TypedError[] = [];
  if (Object.keys(ref).length !== 1 || !declaration.required || declaration.dimName !== field.field_name) errors.push(issue(path, 'object 维度引用须为必需的同名 dimension 参数，仅声明 param'));
  if (field.operator !== undefined && field.operator !== '=') errors.push(issue(path, 'object 维度参数引用仅支持等值条件'));
  if (fields.filter(other => other.field_name === field.field_name).length !== 1) errors.push(issue(path, '原位参数目标不能另有同字段条件'));
  return errors;
}
function timeReferenceErrors(field: JsonObject, ref: JsonObject, declaration: PageParamDeclaration | undefined, fields: JsonObject[], path: string): TypedError[] {
  const errors: TypedError[] = [];
  if (declaration?.type !== 'timeRange' || !declaration.required) errors.push(issue(path, 'object 日期引用必须指向必需的 times 参数'));
  if (!['start','end'].includes(String(ref.part)) || !['iso','compact','datetime'].includes(String(ref.valueFormat)) || Object.keys(ref).some(key => !['param','part','valueFormat','window'].includes(key))) errors.push(issue(path, 'object 日期引用须声明 param、part:start/end 和 valueFormat'));
  if (field.operator !== (ref.part === 'start' ? '>=' : '<=')) errors.push(issue(path, 'object 日期起止引用分别使用 >= 和 <='));
  errors.push(...referenceWindowErrors(ref,declaration,path));
  const siblings = fields.filter(other => other.field_name === field.field_name);
  if (siblings.length !== 2 || !['start','end'].every(part => siblings.some(other => {
    const sibling=dqeRecord(other.value_list);return sibling.param===ref.param && sibling.valueFormat===ref.valueFormat && JSON.stringify(sibling.window)===JSON.stringify(ref.window) && sibling.part===part;
  }))) errors.push(issue(path, 'object 日期字段须成对引用同一参数和格式，不能混入固定条件'));
  return errors;
}
function controlledField(query: PageQuery, field: string): boolean {
  const filters = Object.values(query.filterBindings ?? {});
  return filters.some(binding => bindingQueryFields(binding).includes(field) || ('queryField' in binding && binding.queryField === field)) || Object.values(query.paramBindings ?? {}).some(binding => binding.queryField === field);
}
function visitReferences(value: unknown, path: string, allowed: ReadonlySet<string>, errors: TypedError[]): void {
  if (Array.isArray(value)) { value.forEach((item,index) => visitReferences(item,`${path}/${index}`,allowed,errors)); return; }
  if (!value || typeof value !== 'object') return;
  if ('param' in value && !allowed.has(path)) errors.push(issue(path, '此查询位置不允许页面参数引用'));
  for (const [key,child] of Object.entries(value)) visitReferences(child,`${path}/${key.replaceAll('~','~0').replaceAll('/','~1')}`,allowed,errors);
}
export function objectConditions(item: JsonObject): JsonObject[] {
  const fields=dqeRecord(item.filter).fields;
  return Array.isArray(fields) ? fields.map(dqeRecord) : [];
}
export function resolveObjectParamReferences(query: PageQuery, values: ReadonlyMap<string, PageParamValue>): void {
  for (const field of objectConditions(query.body!.dsl_list[0])) {
    const ref=dqeRecord(field.value_list);
    if(typeof ref.param!=='string')continue;
    const value=values.get(ref.param);
    if(Array.isArray(value)){field.value_list=[...value];continue;}
    const range=referenceRange(value,ref),end=ref.part==='end',boundary=range[end?'end':'start'];
    if(typeof boundary!=='string')throw new Error('object 日期参数缺失或类型错误');
    field.value_list=[objectDateBoundary(boundary,end,ref.valueFormat as ObjectTimeFormat)];
  }
}

function referenceWindowErrors(ref: JsonObject, declaration: PageParamDeclaration | undefined, path: string): TypedError[] {
  if(ref.window===undefined)return [];
  const window=timeWindowZ.safeParse(ref.window);
  if(!window.success || !declaration?.granularity || !timeWindowCompatible(declaration.granularity,window.data)) return [issue(path,'object 日期参数窗口与时间精度不相容')];
  const range=dqeRecord(declaration.value);
  if(typeof range.start==='string' && range.start!==range.end)return [issue(path,'窗口派生要求基准时间参数为单点')];
  return [];
}
function referenceRange(value: PageParamValue | undefined, ref: JsonObject): JsonObject {
  const range=dqeRecord(value);
  if(ref.window===undefined)return range;
  if(typeof range.end!=='string'||range.start!==range.end)throw new Error('object 窗口派生要求单点时间参数');
  return resolveTimeWindow(range.end,ref.window as unknown as TimeWindow);
}
