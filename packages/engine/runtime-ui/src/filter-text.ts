import {mapIocHeader,formatPeriodFact} from '@metriccanvas/page/internal';
import {
  appliedAmountRange,projectFieldSelections, applyFilterTextValues, formatPeriod,
  type FilterTextValueUsage, type FilterTextValueReference, type Page
} from '@metriccanvas/page/internal';
import type { FilterValues } from '../../runtime/src';
import { DEFAULT_NULL_TEXT, formatValue } from '../../widgets/src/shared/value-format';

/** 同一文本投影供页面呈现与导出捕获使用，读取已应用状态而非输入草稿。 */
export function filterTextPage(page: Page, usages: readonly FilterTextValueUsage[], values: FilterValues): Page {
  return projectFieldSelections(applyFilterTextValues(page, usages, reference => filterText(reference, values,page.filters)),values,true);
}

export function filterText(reference: FilterTextValueReference, values: FilterValues,declarations:Page['filters']=[]): string {
  const value = values.get(reference.filter);
  if (!value) return reference.format === 'period' ? '全部期间' : DEFAULT_NULL_TEXT;
  switch (value.type) {
    case 'timePoint': return formatValue(value.value, reference.format);
    case 'timeRange': return formatPeriod({ start: value.from, end: value.to });
    case 'dimension': return value.values.length ? value.values.join('、') : DEFAULT_NULL_TEXT;
    case 'boolean': return formatValue(value.value, reference.format);
    case 'search': return value.query ? formatValue(value.query, reference.format) : DEFAULT_NULL_TEXT;
    case 'numberRange': {
      const declaration=declarations?.find(f=>f.id===reference.filter);if(declaration?.type==='numberRange'&&declaration.units)return appliedAmountRange(declaration,value,values);
      const from = value.from === undefined ? undefined : formatValue(value.from, reference.format);
      const to = value.to === undefined ? undefined : formatValue(value.to, reference.format);
      return from === undefined ? (to === undefined ? DEFAULT_NULL_TEXT : `≤ ${to}`) :
        to === undefined ? `≥ ${from}` : from === to ? from : `${from} 至 ${to}`;
    }
  }
}

export function periodFactPage(page:Page,snapshot:import('@metriccanvas/page/internal').DisplayInputsSnapshot|undefined,revision:number):Page {
 return mapIocHeader(page,header=>{
  if(!header.identity?.facts)return header;
  const facts=header.identity.facts.map(fact=>typeof fact.value==='object'&&'fact' in fact.value?{...fact,value:formatPeriodFact(snapshot,fact.value.fact,fact.value.part,revision)??DEFAULT_NULL_TEXT}:fact);
  return {...header,identity:{...header.identity,facts}};
 });
}
