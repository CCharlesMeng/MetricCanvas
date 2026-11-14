import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {RuntimeDataGateway} from '../../src';
const document=JSON.parse(readFileSync(new URL('../../../../pages/capabilities/filters/ioc-async-preparation.json',import.meta.url),'utf8'));
type Probe={membership:number;dates:number;queries:unknown[];releaseMembership():void;releaseDate():void};
declare global {interface Window {asyncProbe:Probe;remountAsyncPage():void}}

async function mountProbe(page:Page,version='6.120'){
  await page.goto('/examples/inline.html');
  await page.evaluate(async({document,version})=>{
    window.runtime.destroy();
    const url='/dist/metriccanvas-runtime.es.js',fixtureUrl='/__fixtures/key-office-filter.js';
    const api=await import(url),fixtures=await import(fixtureUrl),base:RuntimeDataGateway=fixtures.createKeyOfficePriorityGateway();
    document.schemaVersion=version;
    if(version==='6.119')document.dataSources.offices.source.query.filterBindings['key-national-only']={target:'boolean',queryField:'代表处',whenTrue:['上海代表处','深圳代表处']};
    const state:Probe=window.asyncProbe={membership:0,dates:0,queries:[],releaseMembership(){},releaseDate(){}};
    const dataGateway:RuntimeDataGateway={...base,
      finalizationSource:{body:{dsl_list:[{output_dims:['名称','截止日期'],filter:{}}]},nameField:'名称',dateField:'截止日期'},
      async fetchFilterCandidates(request,options){
        if(request.dimension!=='rep-office-name'||request.filterId==='region')return base.fetchFilterCandidates!(request,options);
        state.membership++;
        await new Promise<void>(resolve=>{state.releaseMembership=resolve;});
        return base.fetchFilterCandidates!(request,options);
      },
      async fetchData(query,context,signal){
        if(query.fieldMappings.name){state.dates++;await new Promise<void>(resolve=>{state.releaseDate=resolve;});return {rows:[{name:'合成经营数据',date:'2026-04-18'}],totalCount:1};}
        if(context?.dataSourceIds?.includes('unrelated'))return {rows:[{office:'无关数据已就绪',amount:88,customer:'战略'}],totalCount:1};
        state.queries.push(query);return base.fetchData(query,context,signal);
      }
    };
    window.runtime=api.mount('#dashboard',{document,dataGateway,initialSearch:''});
    window.remountAsyncPage=()=>{
      window.runtime.destroy();
      window.runtime=api.mount('#dashboard',{document:{...document,id:'async-preparation-next'},dataGateway,initialSearch:''});
    };
  },{document,version});
}

test('published engine renders structure and prepares both conditions before its first business request',async({page})=>{
  await mountProbe(page);
  await expect(page.locator('[data-filter-pending]')).toBeVisible();
  await expect(page.getByRole('cell',{name:'无关数据已就绪',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>({membership:window.asyncProbe.membership,dates:window.asyncProbe.dates,queries:window.asyncProbe.queries.length}))).toEqual({membership:1,dates:1,queries:0});
  await page.evaluate(()=>window.asyncProbe.releaseDate());
  await expect(page.locator('[data-filter-pending]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.asyncProbe.queries)).toEqual([]);
  await page.evaluate(()=>window.asyncProbe.releaseMembership());
  await expect(page.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.asyncProbe.queries)).toEqual([expect.objectContaining({filterValues:expect.arrayContaining([
    {target:'dimension',queryField:'代表处',values:['上海代表处','深圳代表处']},
    {target:'time',period:'month',value:{from:'2026-04',to:'2026-04'}}
  ])})]);
});

test('a later page reuses the single completed finalization cache through a fresh page wrapper',async({page})=>{
  await mountProbe(page);
  await expect.poll(()=>page.evaluate(()=>window.asyncProbe.dates)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.asyncProbe.membership)).toBe(1);
  await page.evaluate(()=>{window.asyncProbe.releaseDate();window.asyncProbe.releaseMembership();});
  await expect(page.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();
  await page.evaluate(()=>window.remountAsyncPage());
  await expect.poll(()=>page.evaluate(()=>window.asyncProbe.membership)).toBe(2);
  await expect(page.locator('[data-filter-pending]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.asyncProbe.dates)).toBe(1);
  await page.evaluate(()=>window.asyncProbe.releaseMembership());
  await expect(page.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.asyncProbe.queries.length)).toBe(2);
});

test('published engine keeps older prepared pages on their original initialization path',async({page})=>{
  await mountProbe(page,'6.119');
  await expect.poll(()=>page.evaluate(()=>window.asyncProbe.dates)).toBe(1);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.locator('[data-filter-pending]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.asyncProbe.membership)).toBe(0);
  await page.evaluate(()=>window.asyncProbe.releaseDate());
  await expect(page.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.asyncProbe.membership)).toBe(0);
});
