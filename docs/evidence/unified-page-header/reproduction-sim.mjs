import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome'});
const base=process.env.HEADER_BASE_URL??'http://127.0.0.1:5196';
const requests=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  await page.clock.install({time:new Date('2026-10-20T12:00:00+08:00')});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().includes('/dsl/execute'))requests.push(...request.postDataJSON().dsl_list);});
  await page.goto(`${base}/pages/dashboard-period-filter`);
  const input=page.locator('[data-ioc-header]').getByRole('combobox');
  await expect(input).toHaveValue('2026 年');
  await expect(page.getByText('2026-01-01~2026-12-31',{exact:true})).toBeVisible();
  await input.click();await page.getByRole('button',{name:'2024',exact:true}).click();
  await expect(page.getByText('2024-01-01~2024-12-31',{exact:true})).toBeVisible();
  await expect(page.getByText('2026-01-01~2026-01-31',{exact:true})).toBeVisible();
  expect(requests.filter(query=>query.output_metrics[0]==='unbound_amount')).toHaveLength(1);
  expect(errors).toEqual([]);
  const result={status:'pass',base,data:'local DQE Sim HTTP, no browser route overrides',requests:requests.length,selectedYear:'2024',errors};
  await writeFile(new URL('./sim-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
