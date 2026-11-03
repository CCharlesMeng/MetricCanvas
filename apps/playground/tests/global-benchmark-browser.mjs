import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.PLAYGROUND_URL??'http://127.0.0.1:5194';
const output=process.argv[2]??'/tmp/global-benchmark-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
const rows=()=>page.locator('tbody tr');
async function select(label,value) {
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.getByRole('option',{name:value,exact:true}).click();
  await page.getByText('代表处与全局均值',{exact:true}).click();
}
async function averages(expected,count) {
  await expect(rows()).toHaveCount(count);
  for(const row of await rows().all())await expect(row.locator('td').nth(2)).toHaveText(expected);
}
try {
  await page.goto(base+'/pages/chart-global-benchmark');
  await averages('15.0%',3);
  await expect(page.locator('[data-component="comparison/mixed"] canvas').first()).toBeVisible();
  await page.screenshot({path:output+'/global.png',fullPage:true});
  await select('地区部','东区');
  await averages('15.0%',2);
  await expect(page.locator('tbody')).not.toContainText('丙代表处');
  await select('统计月份','2026-11');
  await averages('16.0%',2);
  await select('站点','海外');
  await averages('21.0%',2);
  await expect(rows().first().locator('td').nth(1)).toHaveText('26.0%');
  await page.screenshot({path:output+'/east-nov-overseas.png',fullPage:true});
  checks.push('region affects offices only; month/site synchronize actual and independent global average');
  for(const [state,expected] of [['zero','0.0%'],['empty','—']]) {
    await page.goto(base+'/pages/chart-global-benchmark?state='+state);
    await averages(expected,3);
  }
  checks.push('zero retained; successful missing scalar leaves actual and comparison series');
  for(const state of ['duplicate','error']) {
    await page.goto(base+'/pages/chart-global-benchmark?state='+state);
    await expect(page.locator('tbody')).toContainText('暂无数据');
    await expect(page.locator('tbody')).not.toContainText('代表处');
    await expect(page.locator('tbody')).not.toContainText('15.0%');
  }
  checks.push('duplicate/error scalar fails visibly without a fabricated average');
  await page.goto(base+'/pages/chart-global-benchmark');
  await page.setViewportSize({width:720,height:1000});
  await averages('15.0%',3);
  await page.screenshot({path:output+'/narrow.png',fullPage:true});
  expect(errors).toEqual([]);
  await writeFile(output+'/result.json',JSON.stringify({status:'pass',base,checks,errors,evidence:'synthetic preview gateway; no real DQE'},null,2)+'\n');
  console.log(JSON.stringify({status:'pass',checks}));
} finally {await browser.close();}
