import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(new URL('../../../pages/capabilities/chart/chart-table-unit.json',import.meta.url),'utf8'));
declare global {interface Window {__unitTexts:string[]}}
test('custom units appear on the real canvas, hover tooltips and table cells',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.__unitTexts=[];
    const fillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(...args){window.__unitTexts.push(args[0]);return fillText.apply(this,args);};
  });
  await page.setViewportSize({width:1440,height:1100});
  await page.goto(`/pages/${fixture.id}`);
  const charts=page.locator('[_echarts_instance_]');await expect(charts).toHaveCount(4);
  for(const text of ['审批时长（天）','平均用时（天）','金额（万元）','12.5 天','0 天','-2 天','2.5 万元']){
    await expect.poll(()=>page.evaluate(()=>window.__unitTexts)).toContain(text);
  }
  const rows=page.locator('.table-widget tbody tr');await expect(rows).toHaveCount(5);
  await expect(rows.nth(0).getByText('10.5 天',{exact:true})).toBeVisible();
  await expect(rows.nth(1).getByText('12.5 天',{exact:true})).toBeVisible();
  await expect(rows.nth(1).getByText('12.5 万元',{exact:true})).toBeVisible();
  await expect(rows.nth(2).getByText('0 天',{exact:true})).toBeVisible();
  await expect(rows.nth(4).locator('td').nth(1).getByText('--',{exact:true})).toBeVisible();
  await expect(page.locator('[aria-label="表格式图例"]').getByText('12 家',{exact:true})).toBeVisible();
  await charts.first().hover({position:{x:140,y:100}});
  await expect(charts.first().getByText('12.5 天',{exact:true})).toBeVisible();
  await page.mouse.move(0,0);
  await page.getByRole('button',{name:'时长',exact:true}).click();
  await expect(rows.nth(1).getByText('-2 天',{exact:true})).toBeVisible();
  await expect(rows.nth(4).locator('td').nth(1).getByText('--',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/时长/}).click();
  await expect(rows.nth(1).getByText('12.5 天',{exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('unit-wide.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(rows.nth(1).getByText('12.5 天',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('unit-narrow.png'),fullPage:true});
  expect(errors).toEqual([]);
});
