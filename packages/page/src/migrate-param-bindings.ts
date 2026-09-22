import { pageParamDeclarations, type GroupedPageParams } from './page-param';
import { parsePage, normalizePageDocument } from './validate';
import type { PageDocument } from './page-document';
import { bindingQueryFields } from './query';
import { record } from './inline-query-params';
import type { ParamResolutionIssue } from './resolve-page-params';

/** Explicit all-or-nothing migration. It never overwrites the source revision. */
export function migrateParamBindings(input:unknown):{ok:true;document:PageDocument;issues:[]}|{ok:false;issues:ParamResolutionIssue[]} {
  const parsed=parsePage(input);
  if(!parsed.ok)return {ok:false,issues:parsed.errors.map(e=>({code:'INVALID_PAGE',path:e.path,message:e.message}))};
  const normalized=normalizePageDocument(input);
  if(!normalized.ok)return {ok:false,issues:normalized.errors.map(e=>({code:'INVALID_PAGE',path:e.path,message:e.message}))};
  const document=normalized.document;
  document.schemaVersion='6.11';
  if (!document.params || !Array.isArray(document.params)) return {ok:true,document,issues:[]};
  const grouped:GroupedPageParams={query:{}};
  const reject=(id:string,message:string)=>({ok:false as const,issues:[{code:'INVALID_PAGE' as const,path:'/params',param:id,message}]});
  for(const p of pageParamDeclarations(document.params)) {
    const value=p.value??p.default;
    const common={id:p.id,required:p.required,label:p.label};
    if(p.type==='dimension') {
      const fields=new Set<string>();
      for(const ds of Object.values(document.dataSources))if(ds.source.type==='query') {
        const binding=ds.source.query.paramBindings?.[p.id];
        if(binding?.target==='dimension') {
          fields.add(binding.queryField);
        }
      }
      if(p.required===false||fields.size!==1)return reject(p.id,'维度迁移需要必需参数及唯一查询字段');
      (grouped.query!.dimensions??=[]).push({...common,dim_name:[...fields][0],...(value===undefined?{}:{dim_value_list:Array.isArray(value)?value:[String(value)]})});
    } else if(p.type==='time'||p.type==='timeRange') {
      if(p.required===false||!p.granularity)return reject(p.id,'时间迁移需要必需参数和精度');
      const range=typeof value==='string'?{start:value,end:value}:value;
      (grouped.query!.times??=[]).push({...common,granularity:p.granularity,...(range&&typeof range==='object'&&!Array.isArray(range)?{start:range.start,end:range.end}:{})});
    } else (grouped.display??=[]).push({...common,type:p.type,...(value===undefined?{}:{value:value as string|number|boolean})});
  }
  document.params=grouped;
  for(const ds of Object.values(document.dataSources)) {
    if(ds.source.type!=='query')continue;
    const q=ds.source.query, item=q.body.dsl_list[0];
    if(!Object.keys(q.paramBindings??{}).length)continue;
    const filter:Record<string,any>=record(item.filter)?item.filter:{};
    item.filter=filter;
    for(const [id,b] of Object.entries(q.paramBindings??{})) {
      if(b.target==='dimension') {
        if(Object.values(q.filterBindings??{}).some(f=>bindingQueryFields(f).includes(b.queryField)))continue;
        const p=pageParamDeclarations(document.params).find(p=>p.id===id);
        if(p?.required===false)return {ok:false,issues:[{code:'INVALID_PAGE',path:'/params',param:id,message:'可选旧查询绑定无法证明与必填原位引用等价'}]};
        filter.dims=[...(filter.dims??[]),{dim_name:b.queryField,dim_value_list:{param:id}}];
      } else {
        filter.time={...filter.time,param:id,window:b.window};
      }
      delete q.paramBindings![id];
    }
    if(!Object.keys(q.paramBindings??{}).length)delete q.paramBindings;
    delete ds.source.initial;
  }
  const verified=parsePage(document);
  return verified.ok?{ok:true,document,issues:[]}:{ok:false,issues:verified.errors.map(e=>({code:'INVALID_MATERIALIZATION',path:e.path,message:e.message}))};
}
