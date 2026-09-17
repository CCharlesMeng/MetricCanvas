import type { TypedError } from './errors';
import type { DqeQueryDefinition } from './query';
import type { PageParamDeclaration } from './page-param';
import { timeWindowZ } from './schema/data-source';
import { timeWindowCompatible } from './time-param';
import { canonicalizeJson } from './canonical-json';

export const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const pointer = (v: string): string => v.replaceAll('~','~0').replaceAll('/','~1');
export interface InlineQueryUsage { path: string; param: string; target: 'dimension'|'time'; queryField?: string; }

/** Inspect only query definitions: business rows are never interpreted as references. */
export function inspectInlineQuery(query: DqeQueryDefinition, params: readonly PageParamDeclaration[], base = ''): { usages: InlineQueryUsage[]; errors: TypedError[] } {
  const errors: TypedError[]=[]; const usages: InlineQueryUsage[]=[];
  const allowed=new Set<string>(); const declarations=new Map(params.map(p=>[p.id,p]));
  const error=(path:string,message:string)=>errors.push({type:'SCHEMA_ERROR',path,message});
  const body=query.body.dsl_list[0]; const filter:Record<string,any>=record(body.filter)?body.filter:{};
  const prefix=`${base}/body/dsl_list/0/filter`;
  const dims:unknown[]=Array.isArray(filter.dims)?filter.dims:[];
  for(const [i,dim] of dims.entries()) {
    if(!record(dim)||!record(dim.dim_value_list)) continue;
    const ref=dim.dim_value_list; const path=`${prefix}/dims/${i}/dim_value_list`;
    allowed.add(path);
    if(Object.keys(ref).length!==1||!validId(ref.param)) {error(path,'维度引用仅允许 {param:Id}'); continue;}
    const p=declarations.get(ref.param);
    usages.push({path,param:ref.param,target:'dimension',queryField:dim.dim_name});
    if(p?.type!=='dimension'||p.required===false) error(path,'维度原位引用必须引用必需的dimension参数');
    if(typeof dim.dim_name!=='string'||!dim.dim_name||dims.filter(d=>record(d)&&d.dim_name===dim.dim_name).length!==1) error(path,'同一查询维度只能有一个条件来源');
  }
  const time=record(filter.time)?filter.time:{};
  if(record(time.start)||record(time.end)) {
    const path=`${prefix}/time`; const start=time.start,end=time.end;
    allowed.add(`${path}/start`); allowed.add(`${path}/end`);
    if(!validTimeRef(start,'start')||!validTimeRef(end,'end')||start.param!==end.param||canonicalizeJson(start.window??null)!==canonicalizeJson(end.window??null)) {
      error(path,'时间原位引用必须成对使用同一参数、相同window和start/end');
    } else {
      const p=declarations.get(start.param);
      usages.push({path:`${path}/start`,param:start.param,target:'time'},{path:`${path}/end`,param:start.param,target:'time'});
      if(p?.type!==(start.window?'time':'timeRange')||p.required===false) error(path,'时间引用必须为匹配类型的必需参数');
      if(time.period!==(p?.granularity==='month'?'month':'day')) error(path,'时间引用精度与period不相容');
      if(start.window&&p?.granularity&&!timeWindowCompatible(p.granularity,start.window)) error(path,'时间窗口与参数精度不相容');
      if(Object.values(query.filterBindings??{}).some(b=>b.target==='time')) error(path,'固定时间参数不得与时间筛选共同控制查询');
    }
  }
  function walk(v:unknown,path:string) {
    if(Array.isArray(v)) {v.forEach((x,i)=>walk(x,`${path}/${i}`));return;}
    if(!record(v))return;
    if(Object.hasOwn(v,'param')&&!allowed.has(path)) error(path,'此DQE位置不允许参数引用');
    for(const [k,x] of Object.entries(v))walk(x,`${path}/${pointer(k)}`);
  }
  walk(query.body,`${base}/body`);
  if(usages.length&&Object.keys(query.paramBindings??{}).length)error(base,'同一查询不得混用原位引用和paramBindings');
  return {usages,errors};
}
function validId(v:unknown):v is string {return typeof v==='string'&&/^[a-z0-9][a-z0-9-]*$/.test(v);}
function validTimeRef(v:unknown,part:string):v is Record<string,any> {
  return record(v)&&validId(v.param)&&v.part===part&&Object.keys(v).every(k=>['param','part','window'].includes(k))&&(!Object.hasOwn(v,'window')||timeWindowZ.safeParse(v.window).success);
}

/** Last sending boundary also protects callers that bypass Page validation. */
export function assertNoQueryParamReferences(value: unknown): void {
  if(Array.isArray(value)) {value.forEach(assertNoQueryParamReferences);return;}
  if(!record(value))return;
  if(Object.hasOwn(value,'param'))throw new Error('DQE请求包含未解析的参数引用');
  Object.values(value).forEach(assertNoQueryParamReferences);
}
