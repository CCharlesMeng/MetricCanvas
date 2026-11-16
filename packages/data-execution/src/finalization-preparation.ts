import {availabilityInitial,finalizationName,rollingFinalizationName,supportsNativePreparation,type Page,type DisplayInputsSnapshot,type FilterDeclaration} from '@metriccanvas/page/internal';
import type {RuntimeDataGateway} from './ports';
import {initialFilterValues,type FilterValues} from './filter-values';
import {lookupFinalizationDates} from './finalization';

/** Async defaults are absent until resolved; explicit values never become temporary defaults. */
export function createFinalizationPreparation(page:Page,gateway:RuntimeDataGateway,explicit:FilterValues,now:Date,signal:AbortSignal,displayInputs?:DisplayInputsSnapshot,rollingInputs:ReadonlySet<string>=new Set()) {
  const native=supportsNativePreparation(page);
  const declarations=page.filters??[];
  const filters=declarations.filter(filter=>!!finalizationName(filter)&&!explicit.has(filter.id)&&!availabilityInitial(filter,displayInputs,0))
    .map(filter=>rollingInputs.has(filter.id)?rollingDefault(filter):filter);
  const unresolved=new Set(filters.map(filter=>filter.id));
  const pending=new Set(native?unresolved:[]);
  const lookupFilters=native?declarations.filter(filter=>unresolved.has(filter.id)||rollingFinalizationName(filter)):declarations;
  let request:Promise<ReadonlyMap<string,string>>|undefined;
  function resolve():Promise<ReadonlyMap<string,string>> {
    request??=lookupFinalizationDates({...page,filters:lookupFilters},gateway,signal);
    return request;
  }
  return {
    pending,
    unresolved,
    initialDates:()=>native?Promise.resolve(new Map<string,string>()):resolve(),
    resolve,
    initialValues:(dates:ReadonlyMap<string,string>)=>native?new Map<string,import('./filter-values').FilterValue>():initialFilterValues(filters,now,displayInputs,0,dates),
    values:(dates:ReadonlyMap<string,string>)=>initialFilterValues(filters,now,displayInputs,0,dates)
  };
}

function rollingDefault(filter:FilterDeclaration):FilterDeclaration {
  const name=rollingFinalizationName(filter);
  if(filter.type!=='timeRange'||!name)return filter;
  return {...filter,default:{mode:'last12Months',finalizationName:name}};
}
