import {readFileSync} from 'node:fs';
import {expect,test,type Page} from '@playwright/test';

const document=JSON.parse(readFileSync(new URL('../../../../pages/capabilities/navigation/table-multi-source-navigation.json',import.meta.url),'utf8'));
const stages=['代表处SDT','代表处SDT','地区部SDT','华为云计算SDT'];

async function mountRows(page:Page,entry:'es'|'global',intercept=false,disabled=false){
 await page.goto('/examples/inline.html');
 await page.waitForFunction(()=>Boolean(window.runtime));
 await page.evaluate(async({document,entry,intercept,disabled})=>{
  window.runtime.destroy();
  const path='/dist/metriccanvas-runtime.es.js';
  const api=entry==='es'?await import(path):MetricCanvas;
  if(disabled)document.sections[0].components[1].props.columns[4].navigate.enabledWhen={row:'stage-name',op:'ne',value:'地区部SDT'};
  window.queryEvents=[];
  sessionStorage.removeItem('row-navigation-event');
  window.runtime=api.mount('#dashboard',{
   document,initialSearch:'',
   onEvent(event:import('../../src').RuntimeEvent){
    window.queryEvents.push(event);
    if(event.type==='navigate')sessionStorage.setItem('row-navigation-event',JSON.stringify(event));
   },
   ...(intercept?{navigation:{navigate(){return true;}}}:{})
  });
 },{document,entry,intercept,disabled});
 await expect(page.locator('a.link-cell')).toHaveCount(4);
}

for(const entry of ['es','global'] as const){
 test(`${entry}: each stage with a shared business key navigates with its own row parameters`,async({page})=>{
  for(const [index,stage] of stages.entries()){
   await mountRows(page,entry);
   const row=page.locator('tbody tr').nth(index);
   await expect(row.locator('td').nth(3)).toHaveText(index===0?'合成客户甲':'合成客户乙');
   await expect(row.locator('a.link-cell')).toHaveText(index===0?'1':'12');
   await row.locator('a.link-cell').click();
   await expect(page).toHaveURL(/\/pages\/table-multi-source-navigation-detail\?/);
   const url=new URL(page.url());
   expect(url.searchParams.get('project-name')).toBe(index===0?'合成项目甲':'合成项目乙');
   expect(url.searchParams.get('rep-office-name')).toBe('合成代表处');
   expect(url.searchParams.get('stage-name')).toBe(stage);
   await expect(page.locator('.runtime-view')).toContainText(stage);
   expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('row-navigation-event')!).type)).toBe('navigate');
  }
 });

 test(`${entry}: emits navigation to the integrating application and preserves stage action restrictions`,async({page})=>{
  await mountRows(page,entry,true,true);
  const links=page.locator('a.link-cell');
  await expect(links.nth(2)).toHaveAttribute('aria-disabled','true');
  await links.nth(2).dispatchEvent('click');
  expect(await page.evaluate(()=>window.queryEvents.filter(event=>event.type==='navigate'))).toHaveLength(0);
  await links.nth(1).click();
  await links.nth(3).click();
  const events=await page.evaluate(()=>window.queryEvents.filter(event=>event.type==='navigate'));
  expect(events.map(event=>new URL(event.href,'https://example.invalid').searchParams.get('stage-name'))).toEqual(['代表处SDT','华为云计算SDT']);
  await expect(page).toHaveURL(/\/examples\/inline.html$/);
 });
}
