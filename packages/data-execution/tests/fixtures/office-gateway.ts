import offices from './offices.json';
import type {EffectiveQuery,Row} from '@metriccanvas/page/internal';
import type {DataGateway} from '../../src';
import {filterTableRows,sortTableRows} from '../../src/table-view';
export function officeGateway(calls:EffectiveQuery[]=[]):DataGateway { return {async fetchData(query){
  calls.push(structuredClone(query));
  let rows:Row[]=offices.map(row=>({...row}));
  for(const f of query.filterValues) {
    if(f.target==='dimension'&&f.queryField==='rep_office_code')rows=rows.filter(row=>f.values.includes(row['rep-office-code'] as string));
    if(f.target==='metricRange') {
      const field=Object.entries(query.fieldMappings).find(([,d])=>'queryField' in d&&d.queryField===f.metric)?.[0];
      if(field)rows=filterTableRows(rows,[...(f.from===undefined?[]:[{field,op:'gte' as const,value:f.from}]),...(f.to===undefined?[]:[{field,op:'lte' as const,value:f.to}])]);
    }
  }
  if(query.sort)rows=sortTableRows(rows,query.sort.map(rule=>({field:Object.entries(query.fieldMappings).find(([,d])=>'queryField' in d&&d.queryField===rule.queryField)![0],direction:rule.direction})));
  const totalCount=rows.length;
  if(query.pagination)rows=rows.slice(query.pagination.offset,query.pagination.offset+query.pagination.limit);
  rows=rows.map(row=>Object.fromEntries(Object.keys(query.fieldMappings).map(field=>[field,row[field]])));
  return {rows,totalCount};
} }; }
