import {dqeRecord,isObjectDqeItem} from './dqe-object';
import {iocHeaderDeclaration} from './header-binding';
import {queryLeaves} from './query-selection';
import type {Page} from './page';
import type {DqeFilterBinding,DqeQueryDefinition} from './query';

function ordinaryTimeBinding(binding:DqeFilterBinding):boolean {
  return binding.target==='time'&&!binding.periodPolicy&&!binding.periodComparison&&!binding.queryField&&!binding.valueFormat&&!binding.window;
}
function defaultPeriodIds(query:DqeQueryDefinition,page:Page):Set<string> {
  const ids=new Set<string>();
  if(isObjectDqeItem(query.body?.dsl_list[0]))return ids;
  const claimed=new Set(iocHeaderDeclaration(page)?.filterIds);
  for(const filter of page.filters??[]){
    if(filter.type!=='timeRange'||filter.display!=='period'||!claimed.has(filter.id))continue;
    const binding=query.filterBindings?.[filter.id];
    if(binding&&ordinaryTimeBinding(binding))ids.add(filter.id);
  }
  return ids;
}

/** IOC periods follow the applied selection unless a query explicitly owns its time semantics. */
export function withIocPeriodDefaults(query:DqeQueryDefinition,page:Page):DqeQueryDefinition {
  const ids=defaultPeriodIds(query,page);
  if(!ids.size)return query;
  const filterBindings={...query.filterBindings};
  for(const id of ids)filterBindings[id]={target:'time',periodPolicy:{kind:'selection',supportedPeriods:['year','quarter','month']}};
  const body=structuredClone(query.body!);
  // Legacy precision is superseded; fixed ranges and parameter conflicts remain visible to validation.
  delete dqeRecord(dqeRecord(body.dsl_list[0].filter).time).period;
  return {...query,body,filterBindings};
}

/** Old embedded rows cannot prove which grain produced them; all static branches participate. */
export function hasIocPeriodDefault(query:DqeQueryDefinition,page:Page):boolean {
  return queryLeaves(query).some(leaf=>defaultPeriodIds(leaf,page).size>0);
}
