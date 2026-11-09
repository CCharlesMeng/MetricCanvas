import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

test.use({acceptDownloads:true});

async function settleCharts(page:Page) {
  let previous=Buffer.alloc(0);
  await expect.poll(async()=>{
    const charts=await page.locator('.echart').all();
    const current=Buffer.concat(await Promise.all(charts.map(chart=>chart.screenshot())));
    const stable=current.equals(previous);previous=current;return stable;
  },{intervals:[250,500],timeout:10000}).toBe(true);
}

test('完整月报的月份联动、响应布局与当前月份 PDF',async({page},info)=>{
  test.setTimeout(150000);
  const errors:string[]=[],requests:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().includes('/dsl/execute'))requests.push(request.url());});
  await page.goto('/pages/report-monthly-complete');
  const cards=page.locator('.metric-card'),table=page.getByRole('table');
  await expect(page.getByRole('heading',{name:'2026-10 经营分析月报',exact:true})).toBeVisible();
  await expect(page.locator('[data-ioc-header]')).toHaveCount(0);
  await expect(cards).toHaveCount(4);
  for(const [index,value] of ['1,186','4,380','22.1%','95.6%'].entries())await expect(cards.nth(index)).toContainText(value);
  await expect(table.locator('tbody tr')).toHaveCount(4);
  await expect(page.locator('.echart canvas')).toHaveCount(2);
  await settleCharts(page);
  const trend=await page.locator('.echart').first().screenshot({animations:'disabled'});

  const month=page.getByRole('combobox',{name:'报告月份'});
  await month.fill('2026-09');await month.press('Enter');
  await expect(page.getByRole('heading',{name:'2026-09 经营分析月报',exact:true})).toBeVisible();
  for(const [index,value] of ['1,144.6','4,272','21.9%','94.2%'].entries())await expect(cards.nth(index)).toContainText(value);
  await expect(table.locator('tbody tr').first()).toContainText('370.6');
  await expect(table.locator('tbody tr').last()).toContainText('204.6');
  await settleCharts(page);
  expect(Buffer.compare(await page.locator('.echart').first().screenshot({animations:'disabled'}),trend)).not.toBe(0);
  await page.reload();
  await expect(page.getByRole('heading',{name:'2026-09 经营分析月报',exact:true})).toBeVisible();
  await expect(cards.first()).toContainText('1,144.6');

  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1100});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await settleCharts(page);
    await page.screenshot({path:info.outputPath(`report-${width}.png`),fullPage:true,animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:1100});
  const downloaded=page.waitForEvent('download',{timeout:90000});
  await page.getByRole('button',{name:'下载 PDF',exact:true}).click();
  const download=await downloaded,pdf=info.outputPath('report.pdf');
  await download.saveAs(pdf);
  expect(readFileSync(pdf).subarray(0,5).toString()).toBe('%PDF-');
  expect(download.suggestedFilename()).toBe('2026-09 经营分析月报.pdf');
  expect(errors).toEqual([]);expect(requests).toEqual([]);
});
