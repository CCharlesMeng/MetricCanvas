import {expect,test,type Page} from '@playwright/test';
type Trace={kind:string;at:number;value:{query?:{filterValues:Array<{target:string;queryField?:string;values?:string[];value?:{from:string;to:string}}>};context?:{dataSourceIds?:string[]}}};
async function observe(page:Page){
  const traces:Trace[]=[];
  await page.exposeFunction('captureAsyncPreparation',(value:Trace)=>traces.push(value));
  await page.addInitScript(()=>window.addEventListener('metriccanvas:async-preparation',event=>{
    (window as unknown as {captureAsyncPreparation(value:unknown):void}).captureAsyncPreparation((event as CustomEvent).detail);
  }));
  return traces;
}
function mainQueries(traces:Trace[]){return traces.filter(item=>item.kind==='query'&&item.value.context?.dataSourceIds?.includes('offices'));}

test('structure and unrelated data appear before defaults; first business query has the complete scope',async({page})=>{
  const traces=await observe(page),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/pages/ioc-async-preparation');
  await expect(page.locator('[data-filter-pending]')).toBeVisible();
  await expect(page.getByRole('cell',{name:'无关数据已就绪',exact:true})).toBeVisible();
  expect(mainQueries(traces)).toHaveLength(0);
  await expect(page.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'深圳代表处',exact:true})).toBeVisible();
  expect(traces.filter(item=>item.kind==='membership-start')).toHaveLength(1);
  expect(traces.filter(item=>item.kind==='finalization-start')).toHaveLength(1);
  const query=mainQueries(traces)[0];
  expect(query.value.query?.filterValues).toEqual(expect.arrayContaining([
    {target:'dimension',queryField:'代表处',values:['上海代表处','深圳代表处']},
    {target:'time',period:'month',value:{from:'2026-04',to:'2026-04'}}
  ]));
  expect(query.at).toBeGreaterThanOrEqual(traces.find(item=>item.kind==='membership-ready')!.at);
  expect(query.at).toBeGreaterThanOrEqual(traces.find(item=>item.kind==='finalization-ready')!.at);
  await expect(page.locator('[data-filter-pending]')).toHaveCount(0);expect(errors).toEqual([]);
});

test('explicit period and unchecked membership bypass both asynchronous defaults',async({page})=>{
  const traces=await observe(page);
  await page.goto('/pages/ioc-async-preparation?key-national-only=false&mtime=month:2026-04');
  await expect(page.getByRole('cell',{name:'南京代表处',exact:true})).toBeVisible();
  expect(traces.filter(item=>item.kind==='membership-start'||item.kind==='finalization-start')).toEqual([]);
});

for(const state of ['empty','error'])test(`membership ${state} cannot send an unrestricted query`,async({page})=>{
  const traces=await observe(page);
  await page.goto(`/pages/ioc-async-preparation?state=${state}`);
  await expect(page.getByRole('cell',{name:'无关数据已就绪',exact:true})).toBeVisible();
  await page.waitForTimeout(2300);
  expect(mainQueries(traces)).toEqual([]);
  await expect(page.getByRole('cell',{name:'南京代表处',exact:true})).toHaveCount(0);
});

test('checking membership removes broader retained rows while the new scope is pending',async({page})=>{
  const traces=await observe(page);
  await page.goto('/pages/ioc-async-preparation?key-national-only=false&mtime=month:2026-04');
  await expect(page.getByRole('cell',{name:'南京代表处',exact:true})).toBeVisible();
  const before=mainQueries(traces).length;
  await page.getByRole('checkbox',{name:'仅看重点国代'}).check();
  await expect(page.getByRole('cell',{name:'南京代表处',exact:true})).toHaveCount(0);
  expect(mainQueries(traces)).toHaveLength(before);
  await expect(page.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'南京代表处',exact:true})).toHaveCount(0);
});

test('a time selection made during initialization wins over the late cutoff',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-14T04:00:00Z'));
  const traces=await observe(page);
  await page.goto('/pages/ioc-async-preparation');
  await expect(page.locator('[data-filter-pending]')).toBeVisible();
  await page.getByRole('button',{name:'月',exact:true}).click();
  await expect(page.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();
  expect(mainQueries(traces)[0].value.query?.filterValues).toContainEqual({target:'time',period:'month',value:{from:'2026-11',to:'2026-11'}});
  await expect(page.locator('[data-filter-pending]')).toHaveCount(0);
});
