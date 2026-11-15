import {availabilityInitial,finalizationName,supportsNativePreparation,type Page,type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import type {RuntimeDataGateway} from './ports';
import {initialFilterValues,type FilterValues} from './filter-values';
import {resolveFinalizationDates} from './finalization';

/** Async defaults are absent until resolved; explicit values never become temporary defaults. */
export function createFinalizationPreparation(page:Page,gateway:RuntimeDataGateway,explicit:FilterValues,now:Date,signal:AbortSignal,displayInputs?:DisplayInputsSnapshot) {
  const native=supportsNativePreparation(page);
  const filters=(page.filters??[]).filter(filter=>!!finalizationName(filter)&&!explicit.has(filter.id)&&!availabilityInitial(filter,displayInputs,0));
  const unresolved=new Set(filters.map(filter=>filter.id));
  const pending=new Set(native?unresolved:[]);
  let request:Promise<ReadonlyMap<string,string>>|undefined;
  function resolve():Promise<ReadonlyMap<string,string>> {
    request??=resolveFinalizationDates(native?{...page,filters}:page,gateway,now,signal);
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
