import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../src/validate';

const document=()=>JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/period-comparison/period-comparison-query-page.json',import.meta.url),'utf8'));
it('accepts a complete query-paged comparison without mutating the author document',()=>{
  const raw=document(),before=structuredClone(raw);
  expect(parsePage(raw)).toMatchObject({ok:true});expect(raw).toEqual(before);
});
it.each(['version','legacy','records','fact','role','owner','missing-binding','computed-filter','computed-sort','forward-input','overwrite','nonnullable-output','missing-zero-key','unknown-operator'])('rejects an invalid comparison contract: %s',kind=>{
  const raw=document(),data=raw.dataSources.comparison,source=data.source;
  if(kind==='version')raw.schemaVersion='6.77';
  if(kind==='legacy'){source.pagination={pageSize:10};source.fallback={maxRows:1000};}
  if(kind==='records')source.records={maxBytes:4096,timeoutMs:1000};
  if(kind==='fact')raw.dataSources.previous.source.query.filterBindings.period.periodComparison.fact='other';
  if(kind==='role')raw.dataSources.current.source.query.filterBindings.period.periodComparison.kind='previousPeriod';
  if(kind==='owner')source.members.previous.canSelectPage=true;
  if(kind==='missing-binding')delete raw.dataSources.previous.source.query.filterBindings.period;
  if(kind==='computed-filter')raw.sections[0].components[0].props.columns[4].filterable={mode:'numberRange'};
  if(kind==='computed-sort')source.ordering.sortableFields.push('previous-growth');
  if(kind==='forward-input')data.compute[0].minuend='previous-growth';
  if(kind==='overwrite')data.compute[0].output='current-sales';
  if(kind==='nonnullable-output')data.fields['previous-growth'].nullable=false;
  if(kind==='missing-zero-key')source.projection.customer.onMissing='zero';
  if(kind==='unknown-operator')data.compute=[{op:'unionKeys',sources:['current'],keys:['customer']}];
  expect(parsePage(raw).ok).toBe(false);
});
it('gates comparison membership even when the table does not calculate fields',()=>{
  const raw=document(),data=raw.dataSources.comparison;
  const outputs=new Set(data.compute.map((op:{output:string})=>op.output));delete data.compute;
  for(const field of outputs)delete data.fields[field as string];
  for(const projection of Object.values(data.source.projection) as Array<{onMissing?:string}>)delete projection.onMissing;
  raw.sections[0].components[0].props.columns=raw.sections[0].components[0].props.columns.filter((col:{field:{field:string}})=>!outputs.has(col.field.field));
  expect(parsePage(raw)).toMatchObject({ok:true});raw.schemaVersion='6.77';expect(parsePage(raw).ok).toBe(false);
});
