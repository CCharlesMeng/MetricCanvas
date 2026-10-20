import { isNavigationHref, filterURLKeys, type NavigationTarget, type Row } from '@metriccanvas/page/internal';
import {navigationInputIssue,type NavigationInputContract} from './navigation-inputs';
import type { FilterValue, FilterValues } from './filter-state';
import { serializePageParam, type PageParamValues } from './page-params';

/** 只按显式绑定构造普通 URL；相对路径留给承载文档解析。 */
export function navigationHref(target: NavigationTarget, filters: FilterValues, params: PageParamValues, row: Row = {}): string {
  if (!isNavigationHref(target.href)) throw new Error('导航只允许 HTTP(S) 或相对 URL');
  const hashIndex = target.href.indexOf('#');
  const hash = hashIndex < 0 ? '' : target.href.slice(hashIndex);
  const address = hashIndex < 0 ? target.href : target.href.slice(0, hashIndex);
  const queryIndex = address.indexOf('?');
  const path = queryIndex < 0 ? address : address.slice(0, queryIndex);
  const query = new URLSearchParams(queryIndex < 0 ? '' : address.slice(queryIndex + 1));
  for (const [key, binding] of Object.entries(target.query ?? {})) {
    const value = binding.source === 'row' ? row[binding.field]
      : binding.source === 'param' ? params.get(binding.id)
      : filterPart(filters.get(binding.id), binding.part ?? 'value');
    if (binding.source === 'param' && value && typeof value === 'object' && !Array.isArray(value) && 'start' in value && typeof value.start === 'string' && 'end' in value && typeof value.end === 'string') {
      query.set(key, serializePageParam({start: value.start, end: value.end}));
      continue;
    }
    const values = (Array.isArray(value) ? value : [value]).filter(isQueryValue);
    if (!values.length) {if(target.validateTargetInputs)query.delete(key);continue;}
    query.delete(key);
    for (const item of values) query.append(key, String(item));
  }
  const search = query.toString();
  return `${path}${search ? `?${search}` : ''}${hash}`;
}
function isQueryValue(value: unknown): value is string | number | boolean {
  return (typeof value === 'string' && value !== '') || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}
function filterPart(value: FilterValue | undefined, part: string): unknown {
  if (!value) return undefined;
  if (part === 'from' || part === 'to') return value.type === 'timeRange' || value.type === 'numberRange' ? value[part] : undefined;
  if(part==='mode')return value.type==='timeRange'?value.mode:undefined;
  if (part === 'level') return value.type === 'dimension' ? value.level : undefined;
  if (value.type === 'dimension') return value.values;
  if (value.type === 'timeRange' && value.selection) return value.selection.mode === 'last12Months' ? 'last12Months' : `${value.selection.mode}:${value.selection.value}`;
  if (value.type === 'search') return value.query;
  if (value.type === 'timePoint' || value.type === 'boolean') return value.value;
  return undefined;
}

export type NavigationResolution = {ok:true;href:string}|{ok:false;code:'NAVIGATION_INPUT_INVALID'|'NAVIGATION_INPUT_UNAVAILABLE';message:string};
export function resolveNavigationTarget(target:NavigationTarget,filters:FilterValues,params:PageParamValues,row:Row={},contract?:NavigationInputContract,now=new Date()):NavigationResolution {
  try{
    const href=navigationHref(target,filters,params,row);
    if(!target.validateTargetInputs)return {ok:true,href};
    if(!contract)return {ok:false,code:'NAVIGATION_INPUT_UNAVAILABLE',message:'目标输入契约尚未就绪或不可用'};
    const supplied=new URL(href,'https://metriccanvas.invalid/').searchParams;
    for(const key of Object.keys(target.query??{})){
      const parameter=contract.params.find(p=>p.id===key);
      const filter=contract.filters.find(f=>Object.values(filterURLKeys(f)).includes(key));
      if(!parameter&&!filter)return {ok:false,code:'NAVIGATION_INPUT_INVALID',message:`目标未声明URL输入：${key}`};
      const binding=target.query![key],source=binding.source==='filter'?filters.get(binding.id):undefined;
      if(filter?.type==='dimension'&&filter.hierarchy&&key===filterURLKeys(filter).value&&source?.type==='dimension'&&source.level){const level=supplied.get(filterURLKeys(filter).level!)??filter.defaultLevel??filter.hierarchy[0]?.id;if(level!==source.level)return {ok:false,code:'NAVIGATION_INPUT_INVALID',message:'来源和目标筛选层级不匹配，请显式传递合法层级'};}
      const required=parameter?parameter.required!==false:filter?.type==='dimension'?filter.selection?.required:(filter?.type==='timeRange'||filter?.type==='timePoint')&&filter.required;
      if(required&&!supplied.has(key))return {ok:false,code:'NAVIGATION_INPUT_INVALID',message:`显式映射缺少必需值：${key}`};
    }
    for(const [key,binding]of Object.entries(target.query??{}))if(binding.source==='filter'){const value=filters.get(binding.id),point=contract.filters.find(f=>f.type==='timePoint'&&Object.values(filterURLKeys(f)).includes(key)),param=contract.params.find(p=>p.id===key&&p.type==='time');if((point||param)&&value?.type==='timeRange'&&value.from!==value.to)return {ok:false,code:'NAVIGATION_INPUT_INVALID',message:'时间区间不能隐式截成详情单月或单日'};}
    const issue=navigationInputIssue(href,contract,now);
    return issue?{ok:false,code:'NAVIGATION_INPUT_INVALID',message:issue}:{ok:true,href};
  }catch{return {ok:false,code:'NAVIGATION_INPUT_INVALID',message:'跨页传值不符合导航声明'};}
}
