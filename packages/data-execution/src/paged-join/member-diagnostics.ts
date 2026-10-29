import type {Row} from '@metriccanvas/page/internal';
import {preservedQueryError} from '../query-error';
import type {PagedJoinPlan} from './plan';

class MemberFailure extends Error {
  readonly code: ReturnType<typeof preservedQueryError>['code'];
  constructor(plan:PagedJoinPlan,id:string,cause:unknown) {
    const error=preservedQueryError(cause),member=plan.source.source.members[id];
    const path=`/dataSources/${pointer(plan.sourceId)}/source/members/${pointer(id)}/key`;
    super(`无法合并表格数据：${error.message}\n定位详情：组合源 ${JSON.stringify(plan.sourceId)} → 成员 ${JSON.stringify(id)}（数据源 ${JSON.stringify(member.source)}，关联字段 ${JSON.stringify(member.key.field)}，DQE 字段 ${JSON.stringify(member.key.queryField)}）；配置 ${path}`);
    this.code=error.code;
  }
}

/** Keep member provenance in the existing safe error message across snapshots and console output. */
export function memberFailure(plan:PagedJoinPlan,id:string,cause:unknown):Error {
  return cause instanceof MemberFailure ? cause : new MemberFailure(plan,id,cause);
}

/** A display fallback cannot become a join key. Report shape and position, never the value. */
export function memberKey(plan:PagedJoinPlan,id:string,row:Row,rowIndex:number):string|number {
  const field=plan.source.source.members[id].key.field,key=row[field];
  const type=plan.members.get(id)!.fields[field].type,label=memberKeyLabel(plan,id);
  if(typeof key===type && ((typeof key==='string' && !!key.trim()) || (typeof key==='number' && Number.isFinite(key))))return key;
  const problem=keyProblem(key);
  const cause=Object.assign(new Error(`第 ${rowIndex+1} 行的“${label}”${problem}，无法关联其他数据。请检查查询是否返回了有效的“${label}”。\n字段检查：期望非空 ${type}，实际 ${keyKind(key)}`),{code:'DQE_ROW_CONTRACT_ERROR'});
  throw memberFailure(plan,id,cause);
}

export function memberKeyLabel(plan:PagedJoinPlan,id:string):string {
  const member=plan.source.source.members[id];
  return plan.members.get(id)!.fields[member.key.field].label ?? member.key.queryField;
}
function keyProblem(value:unknown):string {
  if(value==null || (typeof value==='string' && !value.trim()))return '为空';
  return '格式不正确';
}

function keyKind(value:unknown):string {
  if(value===null)return 'null';
  if(Array.isArray(value))return 'array';
  if(typeof value==='string' && !value.trim())return '空字符串';
  if(typeof value==='number' && !Number.isFinite(value))return '非有限 number';
  return typeof value;
}
function pointer(value:string):string{return value.replaceAll('~','~0').replaceAll('/','~1');}
