import {
  availabilityInitial, finalizationMonthIssue, finalizationName, monthFinalizationName,
  rollingFinalizationName, supportsNativePreparation, type Page, type DisplayInputsSnapshot, type FilterDeclaration
} from '@metriccanvas/page/internal';
import type {RuntimeDataGateway} from './ports';
import {initialFilterValues,type FilterValue,type FilterValues,type TimeRangeFilterValue} from './filter-values';
import {lookupFinalizationDates} from './finalization';

/** Keep month inputs out of the applied state until their finalization limit is known. */
export function createFinalizationPreparation(page:Page,gateway:RuntimeDataGateway,explicit:FilterValues,now:Date,signal:AbortSignal,displayInputs?:DisplayInputsSnapshot,rollingInputs:ReadonlySet<string>=new Set()) {
  const native=supportsNativePreparation(page);
  const configured = !!gateway.finalizationSource;
  const asynchronous = native && configured;
  const declarations=page.filters??[];
  const immediate = new Map(explicit);
  const deferred = configured ? deferMonthInputs(declarations, immediate) : new Map<string, TimeRangeFilterValue>();
  const filters=declarations.filter(filter=>!!finalizationName(filter)&&!immediate.has(filter.id)&&!availabilityInitial(filter,displayInputs,0))
    .map(filter=>rollingInputs.has(filter.id)?rollingDefault(filter):filter);
  const unresolved=new Set(filters.map(filter=>filter.id));
  const pending=new Set(asynchronous?unresolved:[]);
  const lookupFilters=native?declarations.filter(filter=>unresolved.has(filter.id)||rollingFinalizationName(filter)||monthFinalizationName(filter)):declarations;
  let request:Promise<ReadonlyMap<string,string>>|undefined;
  function resolve():Promise<ReadonlyMap<string,string>> {
    request??=lookupFinalizationDates({...page,filters:lookupFilters},gateway,signal);
    return request;
  }
  function values(dates: ReadonlyMap<string,string>, pendingIds: ReadonlySet<string> = unresolved): Map<string, FilterValue> {
    const pendingFilters = filters.filter(filter => pendingIds.has(filter.id));
    const restored = new Map<string, FilterValue>();
    for (const filter of pendingFilters) {
      const input = deferred.get(filter.id);
      if (input && !finalizationMonthIssue(filter, input.selection, dates, now)) restored.set(filter.id, input);
    }
    const defaults = initialFilterValues(pendingFilters.filter(filter => !restored.has(filter.id)), now, displayInputs, 0, dates);
    return new Map([...defaults, ...restored]);
  }
  return {
    immediate,
    deferred,
    pending,
    unresolved,
    initialDates:()=>asynchronous?Promise.resolve(undefined):resolve(),
    resolve,
    values
  };
}

function deferMonthInputs(declarations: readonly FilterDeclaration[], immediate: Map<string, FilterValue>) {
  const deferred = new Map<string, TimeRangeFilterValue>();
  for (const filter of declarations) {
    const value = immediate.get(filter.id);
    if (value?.type !== 'timeRange' || !finalizationMonthIssue(filter, value.selection, undefined)) continue;
    deferred.set(filter.id, value);
    immediate.delete(filter.id);
  }
  return deferred;
}

function rollingDefault(filter:FilterDeclaration):FilterDeclaration {
  const name=rollingFinalizationName(filter);
  if(filter.type!=='timeRange'||!name)return filter;
  return {...filter,default:{mode:'last12Months',finalizationName:name}};
}
