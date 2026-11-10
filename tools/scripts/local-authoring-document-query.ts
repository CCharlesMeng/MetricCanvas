import { resolveDocumentContext } from './local-authoring-document-context';
import { findSchema, showSchema } from './local-authoring-schema-query';
import { rulesForOwners } from './local-authoring-query-rules';
import type { KnowledgeQuery, QueryKnowledge, QueryResult } from './local-authoring-query-types';

/** Target pointers are consumed here and never forwarded as resource pointers. */
export function findDocumentSchema(model:QueryKnowledge,options:KnowledgeQuery,document:unknown):QueryResult {
  if(options.at===undefined) throw new TypeError('Target document requires --at');
  if(options.kind && options.kind!=='schema') throw new TypeError('Target document context supports schema find');
  const context=resolveDocumentContext(model,document,options.at);
  const documentContext={status:context.status,documentAt:context.documentAt};
  if(context.status!=='resolved') return {kind:'schema',status:context.status,complete:false,documentContext,
    contextAt:context.contextAt,reason:context.reason,needs:context.needs,
    items:(context.candidates ?? []).map(({id,owner})=>({id,owner}))};
  if(options.owner && options.owner!==context.owner) throw new TypeError('Explicit owner conflicts with target document context');
  const {at:_at,...selection}=options;
  const result=options.query?scopedFind(model,{...selection,owner:context.owner},context.id!):
    {kind:'schema',items:[{id:context.id,owner:context.owner}]};
  return {...result,documentContext,contextRules:rulesForOwners(model,context.enclosingOwners)};
}

function scopedFind(model:QueryKnowledge,options:KnowledgeQuery,id:string):QueryResult {
  const result=findSchema(model,options);
  const placement=showSchema(model,{id,owner:options.owner,select:'placement'});
  const scope=String(placement.path);
  return {...result,items:(result.items as Array<{path:string}>).filter(item=>
    item.path===scope || item.path.startsWith(scope+'.') || item.path.startsWith(scope+'[]'))};
}
