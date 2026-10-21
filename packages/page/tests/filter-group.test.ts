import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePage } from '../src/validate';
import { filterGroupOptions } from '../src/filter-group';

const original = JSON.parse(readFileSync(new URL('../../../pages/filter-group-page.json', import.meta.url), 'utf8'));
const copy=()=>structuredClone(original);
describe('Dashboard filterGroup', () => {
  it('accepts shared query consumers, signed metrics, independent content gates and a nested control', () => {
    const parsed=parsePage(original);expect(parsed.ok).toBe(true);
    if(parsed.ok)expect([...filterGroupOptions(parsed.page)]).toEqual([['channel',['CN','OVERSEAS']],['card-region',['CN','OVERSEAS']]]);
  });
  it('accepts all four migrated chart kinds in existing composite cards',()=>{
    expect(parsePage(JSON.parse(readFileSync(new URL('../../../pages/chart-local-filter-page.json',import.meta.url),'utf8'))).ok).toBe(true);
  });
  it('permits static or conditional hiding without deleting the filter contract',()=>{
    const document=copy();document.filters[1].visible=false;expect(parsePage(document).ok).toBe(true);
    delete document.filters[1].visible;document.filters[1].visibleWhen=document.sections[0].components[0].visibleWhen;expect(parsePage(document).ok).toBe(true);
  });
  const cases:Array<[string,(d:typeof original)=>void,RegExp]>=[
    ['version',d=>{d.schemaVersion='6.44';},/由 6.45 引入/],
    ['report',d=>{d.layout='report';},/Dashboard/],
    ['missing declaration',d=>{d.sections[0].components[0].props.filterId='missing';},/必须引用/],
    ['duplicate values',d=>{d.sections[0].components[0].props.options[1].value='CN';},/不得重复/],
    ['multi default',d=>{d.filters[1].default=['CN','OVERSEAS'];},/default/],
    ['missing default',d=>{delete d.filters[1].default;},/default/],
    ['invalid default',d=>{d.filters[1].default=['missing'];},/default/],
    ['blank label',d=>{d.sections[0].components[0].props.options[0].label=' ';},/pattern/],
    ['unused control',d=>{for(const key of ['orders-data','revenue-data'])delete d.dataSources[key].source.query.filterBindings;},/filterBindings/],
    ['duplicate control',d=>{d.sections[0].components.push({...structuredClone(d.sections[0].components[0]),id:'duplicate'});},/只能声明一个/],
    ['cascade',d=>{d.filters[2].dependsOn='channel';},/级联/],
    ['candidate context',d=>{d.filters[1].candidateContext={filterIds:['scope'],reconcile:'clear'};},/必须引用/],
    ['duplicate header',d=>{d.iocHeader={identity:{title:'演示'},filterIds:['channel']};d.dashboardToolbar='hidden';},/页头/],
    ['detail placement',d=>{d.detailViews=[{id:'detail',mode:'snapshot',components:[{...structuredClone(d.sections[0].components[0]),id:'detail-control'}]}];},/Dashboard/],
    ['obsolete field',d=>{d.sections[2].components[0].props.filter={filterId:'channel',options:[{label:'直营',value:'CN'}]};},/迁移为独立 filterGroup/]
  ];
  it.each(cases)('rejects %s',(_name,change,message)=>{const d=copy();change(d);const parsed=parsePage(d);expect(parsed.ok).toBe(false);expect(parsed.errors.some(e=>message.test(e.message)),JSON.stringify(parsed.errors)).toBe(true);});
});

it('has no legacy declarations left in repository pages and valid fixtures',async()=>{
 const {readdirSync}=await import('node:fs');
 const roots=[new URL('../../../pages/',import.meta.url),new URL('../fixtures/contract-valid/',import.meta.url)];
 const {obsoleteChartFilterErrors}=await import('../src/filter-group');
 for(const root of roots)for(const file of readdirSync(root).filter(name=>name.endsWith('.json'))){
  const document=JSON.parse(readFileSync(new URL(file,root),'utf8'));
  expect(obsoleteChartFilterErrors(document),file).toEqual([]);
 }
});

it('gates newly admitted composite chart children even without a filter control',()=>{
 const d=copy();d.sections=[d.sections[3]];
 const card=d.sections[0].components[0];card.props.components=[structuredClone(original.sections[2].components[0])];
 delete card.props.components[0].visibleWhen;d.schemaVersion='6.44';
 const parsed=parsePage(d);expect(parsed.ok).toBe(false);expect(parsed.errors.some(e=>e.message.includes('由 6.45 引入'))).toBe(true);
});
