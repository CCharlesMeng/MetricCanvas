import { parsePage } from './validate';
import type { PageDocument } from './page-document';
import { record } from './inline-query-params';
import type { ParamResolutionIssue } from './resolve-page-params';

/** Explicit all-or-nothing migration. It never overwrites the source revision. */
export function migrateParamBindings(input:unknown):{ok:true;document:PageDocument;issues:[]}|{ok:false;issues:ParamResolutionIssue[]} {
  const parsed=parsePage(input);
  if(!parsed.ok)return {ok:false,issues:parsed.errors.map(e=>({code:'INVALID_PAGE',path:e.path,message:e.message}))};
  const document=JSON.parse(JSON.stringify(input)) as PageDocument;
  document.schemaVersion='6.5';
  for(const p of document.params??[]) {
    if(p.default!==undefined){p.value=p.default;delete p.default;}
  }
  for(const ds of Object.values(document.dataSources)) {
    if(ds.source.type!=='query')continue;
    const q=ds.source.query, item=q.body.dsl_list[0];
    if(!Object.keys(q.paramBindings??{}).length)continue;
    const filter:Record<string,any>=record(item.filter)?item.filter:{};
    item.filter=filter;
    for(const [id,b] of Object.entries(q.paramBindings??{})) {
      if(b.target==='dimension') {
        const p=document.params?.find(p=>p.id===id);
        if(p?.required===false)return {ok:false,issues:[{code:'INVALID_PAGE',path:'/params',param:id,message:'可选旧查询绑定无法证明与必填原位引用等价'}]};
        filter.dims=[...(filter.dims??[]),{dim_name:b.queryField,dim_value_list:{param:id}}];
      } else {
        filter.time={...filter.time,start:{param:id,part:'start',window:b.window},end:{param:id,part:'end',window:b.window}};
      }
    }
    delete q.paramBindings;
    delete ds.source.initial;
  }
  const verified=parsePage(document);
  return verified.ok?{ok:true,document,issues:[]}:{ok:false,issues:verified.errors.map(e=>({code:'INVALID_MATERIALIZATION',path:e.path,message:e.message}))};
}
