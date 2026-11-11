import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {parsePage} from '@metriccanvas/page';
import {flattenPageComponents,type TableComponent} from '@metriccanvas/page/internal';
import {hierarchyFixture,hierarchySim,choose} from './hierarchy-fixture';
import {hierarchyChoice,resolveHierarchySelection,hierarchyRows,rowExpansionFilters,createHierarchySelectionSession} from '../src/table/hierarchy-selection';
import type {RuntimeDataGateway} from '../src';

const parents=[{'row-id':1,'region-id':'R01'},{'row-id':2,'region-id':'R02'}];
function unusedGateway():RuntimeDataGateway {
  return {fetchData:vi.fn<RuntimeDataGateway['fetchData']>().mockRejectedValue(Error('unexpected query'))};
}

it('keeps all parents and parent-scoped child inputs for IOC global without mutating the selection',async()=>{
  const {page,table,filters}=hierarchyFixture(),gateway=unusedGateway();
  const selected=choose(filters,'全球','region-dept'),before=JSON.stringify([...selected]);
  const context={filters:selected,params:new Map()};
  expect(hierarchyRows(table,parents,hierarchyChoice(table,selected,page))).toEqual(parents);
  await expect(resolveHierarchySelection(page,table,gateway,{...context,blocked:['region']},new AbortController().signal)).rejects.toThrow('候选确认');
  const receipt=await resolveHierarchySelection(page,table,gateway,context,new AbortController().signal);
  expect(receipt).toMatchObject({status:'unrestricted',identity:JSON.stringify(['region-dept',['全球']])});
  expect(hierarchyRows(table,parents,receipt)).toEqual(parents);
  const child=rowExpansionFilters(page,table,parents[0]!,context,receipt);
  expect(child.get('detail-region')).toMatchObject({values:['R01']});
  expect(child.has('detail-office')).toBe(false);
  expect(JSON.stringify([...selected])).toBe(before);
  expect(gateway.fetchData).not.toHaveBeenCalled();
});

it('discards a late office lookup after switching to global',async()=>{
  const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>{
    await pending;
    return {rows:[{'located-region-id':'R01'}],totalCount:1};
  });
  const session=createHierarchySelectionSession(page,table,{...sim.gateway,fetchData},()=>{});
  try{
    session.sync({filters:choose(filters,'O101'),params:new Map()});
    await expect.poll(()=>fetchData.mock.calls.length).toBe(1);
    session.sync({filters:choose(filters,'全球','region-dept'),params:new Map()});
    expect(session.snapshot().status).toBe('unrestricted');
    release();await new Promise(resolve=>setTimeout(resolve,5));
    expect(session.snapshot()).toMatchObject({status:'unrestricted',identity:JSON.stringify(['region-dept',['全球']])});
    expect(session.snapshot().childValue).toBeUndefined();
    expect(hierarchyRows(table,parents,session.snapshot())).toEqual(parents);
  }finally{release();session.dispose();await sim.close();}
});

it('uses the same global rule in the live session while preserving candidate blocking',()=>{
  const {page,table,filters}=hierarchyFixture(),gateway=unusedGateway();
  const context={filters:choose(filters,'全球','region-dept'),params:new Map()};
  const session=createHierarchySelectionSession(page,table,gateway,()=>{});
  try{
    session.sync({...context,blocked:['region']});
    expect(session.snapshot().status).toBe('pending');
    session.sync(context);
    expect(session.snapshot().status).toBe('unrestricted');
    expect(hierarchyRows(table,parents,session.snapshot())).toEqual(parents);
    expect(gateway.fetchData).not.toHaveBeenCalled();
  }finally{session.dispose();}
});

it('retains strict matching for ordinary trees and for non-global IOC values',()=>{
  const {page,table,filters}=hierarchyFixture();
  const ordinary={...page,sections:[],iocHeader:undefined};
  const global=hierarchyChoice(table,choose(filters,'全球','region-dept'),ordinary);
  expect(global).toMatchObject({status:'selected',parentValue:'全球'});
  expect(hierarchyRows(table,parents,global)).toEqual([]);
  const region=hierarchyChoice(table,choose(filters,'R01','region-dept'),page);
  expect(region).toMatchObject({status:'selected',parentValue:'R01'});
  expect(hierarchyRows(table,parents,region)).toEqual([parents[0]]);
});

it('shows the actual authorization page parents when its Region is global',async()=>{
  const document=JSON.parse(readFileSync(new URL('../../../../pages/business/dashboard/ioc/approval/authorization-norms.json',import.meta.url),'utf8'));
  const parsed=parsePage(document);expect(parsed.ok).toBe(true);if(!parsed.ok)throw Error('page');
  const table=flattenPageComponents(parsed.page).find((c):c is TableComponent=>c.type==='table')!;
  const context={filters:choose(new Map(),'全球','region-dept'),params:new Map()};
  const receipt=await resolveHierarchySelection(parsed.page,table,unusedGateway(),context,new AbortController().signal);
  expect(receipt.status).toBe('unrestricted');
  const rows=[{'region-dept':'华东地区部'},{'region-dept':'欧洲地区部'}];
  expect(hierarchyRows(table,rows,receipt)).toEqual(rows);
});
