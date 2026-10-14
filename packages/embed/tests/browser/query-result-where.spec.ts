import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Item = {output_metrics:string[]; filter:{dims:Array<{dim_name:string;dim_value_list:string[]}>}};
test('one full A renders all rows while B/C send independently filtered sets',async({page},testInfo)=>{
  const document=JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/query-result-where-page.json',import.meta.url),'utf8'));
  const requests:Item[]=[];
  const projects=[
    {'项目编号':'HIGH','状态':'进行中','启用':false,'金额':2000000,'时长':0,'日期':'2026-10-01','采集时间':'2026-10-01T00:00:00Z'},
    {'项目编号':'LOW','状态':'进行中','启用':false,'金额':0,'时长':0,'日期':'2026-10-01','采集时间':'2026-10-01T00:00:00Z'},
    {'项目编号':'CLOSED','状态':'结束','启用':false,'金额':3000000,'时长':0,'日期':'2026-10-01','采集时间':'2026-10-01T00:00:00Z'}
  ];
  await page.route('**/where-fixture-dqe',async route=>{
    const body:{dsl_list:Item[]}=route.request().postDataJSON(); requests.push(...body.dsl_list);
    await route.fulfill({json:{retCode:'CBC.0000',results:body.dsl_list.map(item=>{
      const data=item.output_metrics.includes('金额')?projects:item.filter.dims.find(d=>d.dim_name==='项目编号')!.dim_value_list.map(id=>({'项目编号':id,'得分':10}));
      return {code:'SUCCESS',data,total_count:data.length};
    })}});
  });
  await page.goto('/examples/inline.html');
  await page.evaluate(document=>{
    window.runtime.destroy();
    window.runtime=MetricCanvas.mount('#dashboard',{document,dataGateway:MetricCanvas.createDqeGateway({endpoint:'/where-fixture-dqe'})});
  },document);
  const tables=page.getByRole('table'); await expect(tables).toHaveCount(3);
  await expect(tables.nth(0).getByText('HIGH',{exact:true})).toBeVisible();
  await expect(tables.nth(0).getByText('LOW',{exact:true})).toBeVisible();
  await expect(tables.nth(0).getByText('CLOSED',{exact:true})).toBeVisible();
  await expect(tables.nth(1).getByText('HIGH',{exact:true})).toBeVisible();
  await expect(tables.nth(1).getByText('LOW',{exact:true})).toHaveCount(0);
  await expect(tables.nth(2).getByText('LOW',{exact:true})).toBeVisible();
  await expect(tables.nth(2).getByText('HIGH',{exact:true})).toHaveCount(0);
  expect(requests.filter(q=>q.output_metrics.includes('金额'))).toHaveLength(1);
  expect(requests.filter(q=>!q.output_metrics.includes('金额')).map(q=>q.filter.dims.find(d=>d.dim_name==='项目编号')!.dim_value_list).sort()).toEqual([['HIGH'],['LOW']]);
  await page.screenshot({path:testInfo.outputPath('query-result-where.png'),fullPage:true});
});
