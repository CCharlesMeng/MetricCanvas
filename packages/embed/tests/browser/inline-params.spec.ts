import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {extractPageParams,applyPageParamSelection,resolvePageParams} from '../../../page/src/index';

test('6.5 Tokens: HTTP requests, authoritative values, missing inputs and empty periods',async({page})=>{
  const raw=JSON.parse(readFileSync(new URL('../../../page/fixtures/parameter-extraction/tokens-parameter-source.json',import.meta.url),'utf8'));
  const extraction=extractPageParams(raw,{baseline:'local-verified-fixture',dimensionIdentities:Object.fromEntries(Object.keys(raw.dataSources).map(id=>[id,{'区域':'region'}]))});
  if(!extraction.ok)throw Error(JSON.stringify(extraction.issues));
  const selected=applyPageParamSelection(extraction,extraction.candidates.map(c=>c.id));
  if(!selected.ok)throw Error(JSON.stringify(selected.issues));
  const template=selected.document as any;
  template.sections[0].components.unshift({id:'region-title',type:'text',layout:{span:12},props:{body:{param:'region'}}},{id:'period-title',type:'text',layout:{span:12},props:{body:{param:'report-period'}}});
  const requests:any[]=[];
  // Protocol-shaped local HTTP substitute, not real provider data.
  await page.route('**/inline-fixture-dqe',async route=>{
    const body=route.request().postDataJSON();requests.push(...body.dsl_list);
    await route.fulfill({json:{retCode:'CBC.0000',results:body.dsl_list.map((q:any)=>{
      const empty=q.filter.time.start==='2026-07';
      const row=Object.fromEntries([...q.output_dims.map((d:string)=>[d,d==='区域'?'中国区':d==='月份'?'2026-01':'示例']),['Tokens消耗量',123456]]);
      return {code:'SUCCESS',data:empty?[]:[row],total_count:empty?0:1};
    })}});
  });
  await page.goto('/examples/inline.html');
  const mount=async(document:any)=>page.evaluate(document=>{
    window.runtime.destroy();
    window.runtime=MetricCanvas.mount('#dashboard',{document,initialSearch:'region=URL错误值',dataGateway:MetricCanvas.createDqeGateway({endpoint:'/inline-fixture-dqe'})});
  },document);
  const missing=structuredClone(template);missing.dataSources.consumption.source.initial={capturedAt:'2026-01-01T00:00:00Z',rows:[{'Tokens消耗量':999999}]};
  await mount(missing);await expect(page.getByText(/报告期间/).first()).toBeVisible();
  expect(requests).toHaveLength(0);await expect(page.getByText(/999,?999/)).toHaveCount(0);
  const filled=resolvePageParams(template,{region:'中国区','report-period':{start:'2026-01',end:'2026-06',granularity:'month'}});if(!filled.ok)throw Error(JSON.stringify(filled.issues));
  await mount(filled.document);await expect(page.getByRole('table')).toHaveCount(5);
  await expect.poll(()=>requests.length).toBe(5);
  await expect(page.getByText('2026-01 至 2026-06',{exact:true})).toBeVisible();
  await expect(page.getByText('123456',{exact:true}).first()).toBeVisible();
  for(const q of requests){expect(q.filter.dims).toEqual([{dim_name:'区域',dim_value_list:['中国区']}]);expect(q.filter.time).toMatchObject({start:'2026-01',end:'2026-06'});expect(JSON.stringify(q)).not.toContain('"param"');}
  const empty=resolvePageParams(template,{region:'欧洲区','report-period':{start:'2026-07',end:'2026-12',granularity:'month'}});if(!empty.ok)throw Error('fixture');
  await mount(empty.document);await expect.poll(()=>requests.length).toBe(10);
  await expect(page.getByText('2026-07 至 2026-12',{exact:true})).toBeVisible();
  await expect(page.getByText('123456',{exact:true})).toHaveCount(0);
  for(const q of requests.slice(5)){expect(q.filter.dims[0].dim_value_list).toEqual(['欧洲区']);expect(q.filter.time.start).toBe('2026-07');}
  await page.screenshot({path:'/private/tmp/metriccanvas-inline-params-empty.png',fullPage:true});
});
