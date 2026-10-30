import {it,expect} from 'vitest';
import document from '../../../pages/capabilities/table/paged-join-on-demand.json';
import records from '../../../pages/capabilities/table/record-join-on-demand.json';
import old from '../fixtures/contract-valid/paged-join-page.json';
import {parsePage} from '../src';

function withSource(changes:Record<string,unknown>){
  return {...document,dataSources:{...document.dataSources,projects:{...document.dataSources.projects,source:{...document.dataSources.projects.source,...changes}}}};
}
it('gates the explicit pagination capability and preserves legacy declarations',()=>{
  expect(parsePage(document).ok).toBe(true);expect(parsePage(records).ok).toBe(true);expect(parsePage(old).ok).toBe(true);
  expect(parsePage({...document,schemaVersion:'6.75'}).ok).toBe(false);
});
it('requires both sizes explicitly while authoring defaults to ten',()=>{
  expect(parsePage(withSource({pagination:{mode:'query'}})).ok).toBe(false);
  const parsed=parsePage(document);expect(parsed.ok).toBe(true);
  if(!parsed.ok)throw Error('page');expect(parsed.page.dataSources.projects.source).toMatchObject({pagination:{mode:'query',pageSize:10,batchSize:10}});
});

it.each([
  {fallback:{maxRows:1000}},
  {pagination:{mode:'query',pageSize:0,batchSize:10}},
  {pagination:{mode:'query',pageSize:10,batchSize:1001}},
  {records:{batchSize:10,maxBytes:67108864,timeoutMs:60000}},
  {records:{maxRows:100,maxBytes:67108864,timeoutMs:60000}},
  {records:{timeFilters:{},maxBytes:67108864,timeoutMs:60000}},
  {ordering:{...document.dataSources.projects.source.ordering,default:[{field:'approval-count',direction:'desc'},{field:'contract-amount',direction:'desc'}]}}
])('rejects incompatible new declarations %j',changes=>{
  expect(parsePage(withSource(changes)).ok).toBe(false);
});
it('requires a real projected record identity for query pages',()=>{
  const original=records.dataSources['rejection-overview'];
  const projection=Object.fromEntries(Object.entries(original.source.projection).filter(([field])=>field!=='record-id'));
  const value={...records,dataSources:{...records.dataSources,'rejection-overview':{...original,source:{...original.source,projection}}}};
  expect(parsePage(value).ok).toBe(false);
});
