import { bindingQueryFields } from './query';
import { parsePage } from './validate';
import { canonicalizeJson } from './canonical-json';
import { record, pointer } from './inline-query-params';
import { matchesParamDeclaration, pageParamDeclarations, type PageParamDeclaration, type PageParamValue, type TextValue } from './page-param';
import { resolvePageParams, type ParamResolutionIssue } from './resolve-page-params';
import type { PageDocument } from './page-document';

export interface ParameterCandidate {
  id:string; identity:string; declaration:PageParamDeclaration; originalValue:PageParamValue;
  locations:Array<{dataSourceId:string;path:string;queryField?:string}>;
  coveredQueries:string[]; uncoveredQueries:string[]; defaultSelected:boolean;
}
export interface ExtractionContext {
  /** Exact verified revision; authenticity and DQE verification belong to the calling trusted program. */
  baseline:string;
  dimensionIdentities?:Readonly<Record<string,Readonly<Record<string,string>>>>;
  previousCandidates?:readonly ParameterCandidate[];
}
export interface PageParamExtraction {
  ok:true; baseline:string; source:PageDocument; sourceKey:string;
  candidates:ParameterCandidate[]; skipped:Array<{path:string;reason:string}>;
}
type Failure={ok:false;issues:ParamResolutionIssue[]};
const fail=(message:string,path='/dataSources'):Failure=>({ok:false,issues:[{code:'INVALID_PAGE',path,message}]});

/** Deterministic authoring algorithm. No model, query execution, persistence or discovery. */
export function extractPageParams(input:unknown, context:ExtractionContext):PageParamExtraction|Failure {
  const valid=parsePage(input);
  if(!valid.ok)return {ok:false,issues:valid.errors.map(e=>({code:'INVALID_PAGE',path:e.path,message:e.message}))};
  if(!context.baseline)return fail('提取需要最终已验证查询的精确基线');
  const source=JSON.parse(JSON.stringify(input)) as PageDocument;
  const queries=Object.keys(source.dataSources).filter(id=>source.dataSources[id].source.type==='query').sort();
  const groups=new Map<string,ParameterCandidate>(); const skipped:PageParamExtraction['skipped']=[];
  function add(identity:string,declaration:PageParamDeclaration,value:PageParamValue,location:ParameterCandidate['locations'][number]) {
    const signature=canonicalizeJson({identity,type:declaration.type,value});
    const group=groups.get(signature)??{id:'',identity:signature,declaration,originalValue:value,locations:[],coveredQueries:[],uncoveredQueries:[],defaultSelected:false};
    group.locations.push(location);groups.set(signature,group);
  }
  for(const id of queries) {
    const ds=source.dataSources[id];if(ds.source.type!=='query')continue;
    const q=ds.source.query;const base=`/dataSources/${pointer(id)}/source/query/body/dsl_list/0/filter`;
    if(Object.keys(q.paramBindings??{}).length){skipped.push({path:base,reason:'旧绑定须先显式迁移'});continue;}
    const f:Record<string,any>=record(q.body.dsl_list[0].filter)?q.body.dsl_list[0].filter:{};
    if(Array.isArray(f.dims))for(const [index,d] of f.dims.entries()) {
      const path=`${base}/dims/${index}/dim_value_list`;
      if(!record(d)||Object.keys(d).some(k=>!['dim_name','dim_value_list'].includes(k))||typeof d.dim_name!=='string'||!Array.isArray(d.dim_value_list)||!d.dim_value_list.length||!d.dim_value_list.every((x:unknown)=>typeof x==='string'&&x.length)||new Set(d.dim_value_list).size!==d.dim_value_list.length||f.dims.filter((x:any)=>x?.dim_name===d.dim_name).length!==1){skipped.push({path,reason:'仅提取无歧义的简单字符串维度谓词'});continue;}
      const multiple=d.dim_value_list.length>1;
      const identity=context.dimensionIdentities?.[id]?.[d.dim_name]??`${id}:${d.dim_name}`;
      add(identity,{id:'',type:'dimension',required:true,label:d.dim_name,...(multiple?{multiple:true}:{})},multiple?[...d.dim_value_list]:d.dim_value_list[0],{dataSourceId:id,path,queryField:d.dim_name});
    }
    const t=f.time;
    if(record(t)) {
      const granularity=t.period==='month'?'month':t.period==='day'?'date':undefined;
      const declaration:PageParamDeclaration={id:'',type:'timeRange',required:true,label:'报告期间',granularity};
      const value={start:t.start,end:t.end,granularity};
      if(granularity&&matchesParamDeclaration(value,declaration))add(`time:${granularity}`,declaration,value,{dataSourceId:id,path:`${base}/time`});
      else skipped.push({path:`${base}/time`,reason:'只提取明确合法的固定月/日区间，不推断窗口关系'});
    }
  }
  const occupied=new Set(pageParamDeclarations(source.params).map(p=>p.id));
  const candidates=[...groups.values()].sort((a,b)=>a.identity.localeCompare(b.identity,'en'));
  for(const c of candidates) {
    const previous=context.previousCandidates?.find(p=>p.identity===c.identity&&canonicalizeJson(p.locations)===canonicalizeJson(c.locations));
    const hint=c.declaration.type==='timeRange'?'report-period':String(JSON.parse(c.identity).identity).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'dimension';
    const base=previous?.id??hint;let id=base,n=2;while(occupied.has(id))id=`${base}-${n++}`;
    occupied.add(id);c.id=id;c.declaration.id=id;
    c.coveredQueries=[...new Set(c.locations.map(l=>l.dataSourceId))].sort();
    c.uncoveredQueries=queries.filter(id=>!c.coveredQueries.includes(id));
    c.defaultSelected=c.coveredQueries.length>1&&c.coveredQueries.length>queries.length/2;
  }
  return {ok:true,baseline:context.baseline,source,sourceKey:canonicalizeJson(source),candidates,skipped};
}

export function applyPageParamSelection(extraction:PageParamExtraction, selectedIds:readonly string[], textReplacements:Readonly<Record<string,TextValue>>={}):{ok:true;document:PageDocument;originalValues:Record<string,PageParamValue>;issues:[]}|Failure {
  if(canonicalizeJson(extraction.source)!==extraction.sourceKey)return fail('提取来源已改变，须重新提取');
  if(new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!extraction.candidates.some(c=>c.id===id)))return fail('选择包含未知或重复参数');
  const selected=extraction.candidates.filter(c=>selectedIds.includes(c.id));
  const document=structuredClone(extraction.source);
  document.schemaVersion='6.11';
  if (Array.isArray(document.params) && document.params.length) return fail('已有旧参数须先显式迁移，不能在提取时丢弃');
  if (selected.length && (!document.params || Array.isArray(document.params))) document.params={query:{}};
  const originalValues:Record<string,PageParamValue>={};
  for(const c of selected) {
    if (document.params && !Array.isArray(document.params)) {
      const queryParams = (document.params.query ??= {});
      if (c.declaration.type === 'dimension') {
        const names = new Set(c.locations.map(l => l.queryField));
        if (names.size !== 1 || !c.locations[0].queryField) return fail('分组维度参数的查询字段必须一致');
        if (c.locations.some(l => { const ds=document.dataSources[l.dataSourceId]; return ds.source.type === 'query' && Object.values(ds.source.query.filterBindings ?? {}).some(b => bindingQueryFields(b).includes(l.queryField ?? '')); })) return fail('分组维度不能与页内筛选共同控制');
        (queryParams.dimensions ??= []).push({id:c.id, dim_name:c.locations[0].queryField, label:c.declaration.label});
        originalValues[c.id]=Array.isArray(c.originalValue) ? [...c.originalValue] : [String(c.originalValue)];
      } else if (c.declaration.type === 'timeRange' && c.declaration.granularity && typeof c.originalValue === 'object' && !Array.isArray(c.originalValue)) {
        (queryParams.times ??= []).push({id:c.id, granularity:c.declaration.granularity, label:c.declaration.label});
        originalValues[c.id]={start:c.originalValue.start,end:c.originalValue.end};
      } else return fail('分组参数不支持此提取类型');
    }
    for(const location of c.locations) {
      if(c.declaration.type==='dimension') {
        setAt(document,location.path,{param:c.id});
        const ds=document.dataSources[location.dataSourceId];
        if(ds.source.type==='query')for(const [filterId,b] of Object.entries(ds.source.query.filterBindings??{}))if(bindingQueryFields(b).includes(location.queryField ?? '')) {
          const filter=document.filters?.find(f=>f.id===filterId);
          if(filter?.type!=='dimension')return fail('维度筛选类型不匹配');
          const value=Array.isArray(c.originalValue)?c.originalValue:[c.originalValue];
          if(filter.default&&canonicalizeJson(filter.default)!==canonicalizeJson(value))return fail('筛选初值与已验证查询不同，须先确认查询基线');
          delete filter.default;filter.initialParam=c.id;
        }
      }
      else {
        const source = document.dataSources[location.dataSourceId].source;
        if (source.type !== 'query') return fail('来源查询已改变');
        const time = (source.query.body.dsl_list[0].filter as Record<string, any>).time;
        delete time.start; delete time.end; time.param = c.id;
      }
    }
  }
  const pending:string[]=[];
  function textWalk(v:unknown,path:string) {
    if(typeof v==='string') {
      if(Object.hasOwn(textReplacements,path)){setAt(document,path,textReplacements[path]);return;}
      if(selected.some(c=>(typeof c.originalValue==='string'?[c.originalValue]:Array.isArray(c.originalValue)?c.originalValue:typeof c.originalValue==='object'?[c.originalValue.start,c.originalValue.end]:[]).some(x=>v.includes(x))))pending.push(path);
    } else if(Array.isArray(v))v.forEach((x,i)=>textWalk(x,`${path}/${i}`));
    else if(record(v))for(const [k,x] of Object.entries(v))if(!['id','type','param'].includes(k))textWalk(x,`${path}/${pointer(k)}`);
  }
  textWalk(document.sections,'/sections');textWalk(document.meta,'/meta');
  if(pending.length)return fail(`以下文本仍含原值，须显式替换或改为参数引用：${pending.join('、')}`,pending[0]);
  if(selected.length)for(const ds of Object.values(document.dataSources))if(ds.source.type==='query')delete ds.source.initial;
  const resolved=resolvePageParams(document,originalValues);
  if(!resolved.ok)return resolved;
  for(const id of new Set(selected.flatMap(c=>c.coveredQueries))) {
    const before=extraction.source.dataSources[id].source,after=resolved.resolvedPage.dataSources[id].source;
    if(before.type!=='query'||after.type!=='query')return fail('来源查询已改变');
    // Filter-owned targets are checked with their initialized value reinstated.
    const body=structuredClone(after.query.body);
    const f:Record<string,any>=record(body.dsl_list[0].filter)?body.dsl_list[0].filter:{};
    const restored=selected.flatMap(c=>c.locations.filter(l=>l.dataSourceId===id&&l.queryField&&Object.values(after.query.filterBindings??{}).some(b=>bindingQueryFields(b).includes(l.queryField ?? ''))).map(l=>({c,l,index:Number(l.path.split('/').at(-2))}))).sort((a,b)=>a.index-b.index);
    for(const {c,l,index} of restored) {
      f.dims??=[];
      f.dims.splice(index,0,{dim_name:l.queryField,dim_value_list:Array.isArray(c.originalValue)?c.originalValue:[c.originalValue]});
      body.dsl_list[0].filter=f;
    }
    if(canonicalizeJson(body)!==canonicalizeJson(before.query.body))return fail('原值回填与已验证查询不等价',`/dataSources/${pointer(id)}`);
  }
  return {ok:true,document,originalValues,issues:[]};
}
function setAt(root:unknown,path:string,value:unknown) {
  const keys=path.slice(1).split('/').map(k=>k.replaceAll('~1','/').replaceAll('~0','~'));
  let target:any=root;for(const k of keys.slice(0,-1))target=target[k];target[keys.at(-1)!]=structuredClone(value);
}
