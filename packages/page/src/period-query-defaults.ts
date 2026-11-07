import {dqeRecord,isObjectDqeItem} from './dqe-object';
import {queryLeaves} from './query-selection';
import type {FilterDeclaration} from './filter';
import type {DqeFilterBinding,DqeQueryDefinition} from './query';

type PeriodContext={filters?:readonly FilterDeclaration[]};

function ordinaryTimeBinding(binding:DqeFilterBinding):boolean {
  return binding.target==='time'&&!binding.periodPolicy&&!binding.periodComparison&&!binding.queryField&&!binding.valueFormat&&!binding.window;
}
function defaultPeriodIds(query:DqeQueryDefinition,page:PeriodContext):Set<string> {
  const ids=new Set<string>();
  if(isObjectDqeItem(query.body?.dsl_list[0]))return ids;
  for(const filter of page.filters??[]){
    if(filter.type!=='timeRange'||filter.display!=='period')continue;
    const binding=query.filterBindings?.[filter.id];
    if(binding&&ordinaryTimeBinding(binding))ids.add(filter.id);
  }
  return ids;
}

/** Period bindings follow the applied selection independently of control placement. */
export function withPeriodQueryDefaults(query:DqeQueryDefinition,page:PeriodContext):DqeQueryDefinition {
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
export function hasPeriodQueryDefault(query:DqeQueryDefinition,page:PeriodContext):boolean {
  return queryLeaves(query).some(leaf=>defaultPeriodIds(leaf,page).size>0);
}
