import {iocHeaderDeclaration,withIocPeriodDefaults,type DqeQueryDefinition,type Page} from '@metriccanvas/page/internal';

const customerFilterIds=new Set(['customer-category','customer-type','na-type']);

/** IOC Header owns this business query name; display labels and page bindings cannot rename it. */
export function iocHeaderQuery(query:DqeQueryDefinition,page:Page|undefined):DqeQueryDefinition {
  if(!page)return query;
  const header=iocHeaderDeclaration(page);
  if(!header)return query;
  query=withIocPeriodDefaults(query,page);
  const claimed=new Set(header.filterIds);
  const filterBindings={...query.filterBindings};
  for(const [id,binding]of Object.entries(filterBindings)){
    if(customerFilterIds.has(id)&&claimed.has(id)&&binding.target==='dimension'&&'queryField' in binding){
      filterBindings[id]={...binding,queryField:'客户级别'};
    }
  }
  return {...query,filterBindings};
}
