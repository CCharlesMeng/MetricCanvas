import { fileURLToPath } from 'node:url';
import { pageFilesById } from '../../../tools/scripts/page-files.mjs';
import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { parsePage,normalizePageDocument } from '../src/validate';
import { collectFilterTextValueReferences } from '../src/filter-text-value';
import { requiredMinorVersion,capabilityFloorErrors,versionPolicy,versionErrors } from '../src/version';
import { documentUsesRuntimeBackToolbar } from '../src/page';
const load=(name:string)=>JSON.parse(readFileSync(pageFilesById(fileURLToPath(new URL('../../../pages', import.meta.url))).get(`ioc-header-${name}-demo`)!,'utf8'));
describe('IOC root header contract from acceptance pages',()=>{
  for(const name of ['overview','dense-filter','detail','month-set'])it(`consumes ${name} and preserves the declaration on normalize`,()=>{
    const doc=load(name);expect(parsePage(doc)).toMatchObject({ok:true});expect(normalizePageDocument(doc)).toMatchObject({ok:true,document:{...doc,schemaVersion:versionPolicy.current}});
  });
  it('gates the new root capability and every header text path',()=>{
    const doc=load('overview');expect(requiredMinorVersion(doc)).toBe(37);doc.schemaVersion='6.31';expect(capabilityFloorErrors(doc)).not.toEqual([]);
    expect(versionErrors(load('overview'),{...versionPolicy,minor:31,current:'6.31'})).not.toEqual([]);
    expect(collectFilterTextValueReferences(doc).some(item=>item.path==='/iocHeader/identity/facts/0/value')).toBe(true);
  });
  it('drops missing optional identity units and retains an explicit unnamed title',()=>{
    const doc=load('detail');doc.params.display=doc.params.display.filter((p:any)=>p.id!=='project-name');doc.params.display.push({id:'optional-title',type:'string',required:false});doc.iocHeader.identity.title={param:'optional-title'};
    const result=parsePage(doc);expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.page.iocHeader?.identity?.title).toBe('未命名');expect(result.page.iocHeader?.identity?.tags).toHaveLength(1);expect(result.page.iocHeader?.identity?.facts).toHaveLength(1);
  });
  it('rejects toolbar conflicts, hidden/unknown/duplicate filter ownership and duplicate page identity',()=>{
    const mutations=[(d:any)=>d.dashboardToolbar='visible',(d:any)=>d.iocHeader={},(d:any)=>d.iocHeader.filterIds.push('missing'),(d:any)=>d.iocHeader.filterIds.push('region'),(d:any)=>d.filters[1].visible=false,(d:any)=>d.sections[0].components.unshift({id:'old-header',type:'reportHeader',layout:{span:12},props:{title:'旧页头'}})];
    for(const mutate of mutations){const doc=load('overview');mutate(doc);expect(parsePage(doc).ok).toBe(false);}
  });
  it('allows report period placement only when owned by IOC and preserves chapter headers',()=>{
    const doc=load('overview');doc.layout='report';expect(parsePage(doc).ok).toBe(true);
    delete doc.iocHeader;expect(parsePage(doc).ok).toBe(false);
    const no=load('month-set');expect(no.iocHeader.identity).toBeUndefined();
    expect(documentUsesRuntimeBackToolbar(load('detail'))).toBe(true);
  });
});

describe('IOC Region has exactly one legal control shape',()=>{
 const page=()=>JSON.parse(readFileSync('pages/capabilities/filters/key-office-filter-demo.json','utf8'));
 it.each([
  ['flat',(region:any)=>{delete region.hierarchy;}],
  ['select',(region:any)=>region.display='select'],
  ['tabs',(region:any)=>region.display='tabs'],
  ['multiple',(region:any)=>region.selection.mode='multiple'],
  ['external levels',(region:any)=>region.hierarchyPicker='tabs'],
  ['hidden levels',(region:any)=>region.hierarchyPicker='hidden'],
  ['independent tree',(region:any)=>region.treeSelection='independent'],
  ['no search',(region:any)=>region.searchable=false]
 ])('rejects IOC Region %s',(_name,mutate)=>{
  const raw=page();mutate(raw.filters[0]);expect(parsePage(raw).ok).toBe(false);
 });
 it('rejects a Region outside IOC Header ownership',()=>{
  const raw=page();raw.iocHeader.filterIds=raw.iocHeader.filterIds.filter((id:string)=>id!=='region');expect(parsePage(raw).ok).toBe(false);
 });
 it('rejects splitting an IOC Region level into another header control',()=>{
  const raw=page();raw.filters.push({id:'rep-office',type:'dimension',dimension:'demo_office',label:'代表处'});
  raw.iocHeader.filterIds.push('rep-office');expect(parsePage(raw).ok).toBe(false);
 });
 it('rejects moving a split organization filter into IOC content',()=>{
  const raw=page();raw.filters.push({id:'rep-office',type:'dimension',dimension:'demo_office',label:'代表处'});
  expect(parsePage(raw).ok).toBe(false);
 });
 it('preserves hidden query parameters used by hierarchy lookups',()=>{
  const raw=page();raw.filters.push({id:'lookup-office',type:'dimension',dimension:'demo_office',visible:false});
  expect(parsePage(raw).ok).toBe(true);
 });
 it('keeps ordinary multi-select dimensions legal outside the IOC contract',()=>{
  const raw=page();delete raw.iocHeader;raw.filters[0].selection.mode='multiple';
  expect(parsePage(raw).ok).toBe(true);
 });
 it('keeps ordinary flat dimensions legal outside the IOC contract',()=>{
  const raw=page();delete raw.iocHeader;
  raw.filters[0]={id:'region',type:'dimension',dimension:'demo_region',label:'普通维度'};
  raw.dataSources.offices.source.query.filterBindings.region={target:'dimension',queryField:'demo_region'};
  expect(parsePage(raw).ok).toBe(true);
 });
});
