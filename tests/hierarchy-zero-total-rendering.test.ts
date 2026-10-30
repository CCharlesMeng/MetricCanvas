import {afterEach,expect,it,vi} from 'vitest';
import {parsePage} from '../packages/page/src/index';
import type {DataSnapshot,Page,Row} from '../packages/page/src/internal';
import {createSourceProgram,initialFilterValues} from '../packages/data-execution/src/runtime';
import {createTableController} from '../packages/engine/runtime-ui/src/table/controller';
import {createRowExpansionController} from '../packages/engine/runtime/src/table/expansion';
import {prepareHierarchyExport} from '../packages/engine/runtime-ui/src/table/export/hierarchy';
import {createZeroTotalPreview} from '../apps/playground/fixtures/zero-total-gateway';
import document from '../pages/capabilities/query/query-zero-total-hierarchy.json';

afterEach(()=>vi.restoreAllMocks());
function fixture(){
  const parsed=parsePage(structuredClone(document));
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,table=page.sections[0]!.components[0]!;
  if(table.type!=='table')throw Error('table fixture');
  const filters=initialFilterValues(page.filters??[]),gateway=createZeroTotalPreview().dataGateway;
  const controller=createTableController(page,()=>null,()=>{},()=>filters,()=>({}),()=>({filters,params:new Map(),gateway}));
  controller.captureTables(page.sections);
  return {page,table,filters,gateway,controller};
}
async function parentSnapshot(page:Page,gateway:ReturnType<typeof createZeroTotalPreview>['dataGateway']){
  const program=createSourceProgram(page,{gateway});
  let snapshot:DataSnapshot|undefined;
  try{for await(const update of program.read({roots:['zero'],conditions:initialFilterValues(page.filters??[])}))snapshot=update.snapshot;}
  finally{program.dispose();}
  if(snapshot?.status!=='ready')throw Error('expected returned parent rows');
  return snapshot;
}

it('keeps zero-total object rows ready through the real source and hierarchy controller, including local pagination',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>{});
  const {page,table,gateway,controller}=fixture();
  try{
    const snapshot=await parentSnapshot(page,gateway);
    expect(snapshot.totalCount).toBe(0);
    expect(controller.hierarchySnapshot(table,snapshot)).toBe(snapshot);
    expect(controller.present(table,controller.hierarchyRows(table,snapshot.rows)).rows).toEqual([{region:'甲地区部',score:0}]);
    controller.page(table,1);
    expect(controller.present(table,controller.hierarchyRows(table,snapshot.rows)).rows).toEqual([{region:'乙地区部',score:-2}]);
    expect(snapshot.totalCount).toBe(0);
  }finally{controller.dispose();}
});

it('projects a selected parent from the same provisional parent rows',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>{});
  const {page,table,filters,gateway,controller}=fixture();
  try{
    const snapshot=await parentSnapshot(page,gateway);
    filters.set('region',{type:'dimension',dimension:'demo-region',level:'region-dept',values:['乙地区部']});
    controller.captureTables(page.sections);
    await vi.waitFor(()=>expect(controller.hierarchy(table)?.status).toBe('selected'));
    expect(controller.hierarchySnapshot(table,snapshot)).toBe(snapshot);
    expect(controller.hierarchyRows(table,snapshot.rows)).toEqual([{region:'乙地区部',score:-2}]);
  }finally{controller.dispose();}
});

it.each([-1,1,3])('still rejects parent totals other than the zero-count compatibility case: %s',totalCount=>{
  const {table,controller}=fixture();
  try{expect(controller.hierarchySnapshot(table,{status:'ready',rows:[{region:'甲地区部'},{region:'乙地区部'}],totalCount}).status).toBe('error');}
  finally{controller.dispose();}
});

it.each<Row[][]>([[[{region:'甲地区部'},{region:'甲地区部'}]],[[{}]]])('still rejects duplicate or missing parent row keys: %j',rows=>{
  const {table,controller}=fixture();
  try{expect(controller.hierarchySnapshot(table,{status:'ready',rows,totalCount:0}).status).toBe('error');}
  finally{controller.dispose();}
});

it('refuses a complete parent-child export of the displayed zero-total object receipt',async()=>{
  const {page,table,filters,gateway,controller}=fixture();
  try{
    await expect(prepareHierarchyExport({page,component:table,gateway,params:new Map(),queries:new Map(),controller:new AbortController(),
      state:{filters,currentYear:2026,tables:{},headerFilters:{}}})).rejects.toMatchObject({code:'EXPORT_INCOMPLETE_DATA'});
  }finally{controller.dispose();}
});

it('renders an expanded child whose object receipt also reports zero total',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const {page,table,filters,gateway,controller}=fixture();
  const fetch=vi.spyOn(gateway,'fetchData');
  const expansion=createRowExpansionController(page,table,gateway,filters,new Map(),()=>{});
  try{
    const snapshot=await parentSnapshot(page,gateway);
    const rows=controller.hierarchyRows(table,snapshot.rows);
    expansion.sync(rows,{filters,params:new Map()},controller.hierarchy(table));
    expansion.toggle(rows[0]!);
    const child=expansion.get(rows[0]!)!;
    await vi.waitFor(()=>expect(child.snapshots.get(child.table.data.main)).toMatchObject({status:'ready',totalCount:0,rows:[{office:'甲代表处',score:7}]}));
    expect(snapshot.totalCount).toBe(0);
    expect(warn.mock.calls.map(call=>call[1])).toContainEqual(expect.objectContaining({totalCount:0,rowCount:1,completeness:'unverified'}));
    expansion.toggle(rows[0]!);
    expect(expansion.get(rows[0]!)).toBeUndefined();
    const count=fetch.mock.calls.length;expansion.toggle(rows[0]!);
    expect(expansion.get(rows[0]!)?.snapshots.get(child.table.data.main)).toMatchObject({status:'ready',totalCount:0,rows:[{office:'甲代表处',score:7}]});
    expect(fetch).toHaveBeenCalledTimes(count);
  }finally{expansion.dispose();controller.dispose();}
});
