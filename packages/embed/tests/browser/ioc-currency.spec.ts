import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ExcelJS=createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const endpoint='/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
test.use({timezoneId:'Asia/Shanghai'});
test.beforeEach(async({page})=>{page.on('pageerror',error=>{throw error;});await page.clock.install({time:new Date('2026-10-19T12:00:00+08:00')});});
test('amount draft cancel, strict constraints, presets and basic-unit query',async({page})=>{
 const requests:any[]=[];page.on('request',r=>{if(r.url().includes(endpoint)&&r.method()==='POST')requests.push(...r.postDataJSON().dsl_list);});
 await page.goto('/pages/ioc-header-currency-demo');const amount=page.locator('[data-filter-id="amount"]'),table=page.locator('[data-component="body/amount-table"]');
 await expect(table.getByRole('cell',{name:'甲项目',exact:true})).toBeVisible();const start=requests.length;
 await amount.locator('summary').click();await amount.getByRole('textbox',{name:'预签金额下限',exact:true}).fill('100');await amount.getByRole('button',{name:'取消',exact:true}).click();expect(requests).toHaveLength(start);expect(new URL(page.url()).searchParams.has('amount.from')).toBe(false);
 await amount.locator('summary').click();await amount.getByRole('textbox',{name:'预签金额下限',exact:true}).fill('-1');await amount.getByRole('button',{name:'确定',exact:true}).click();await expect(amount.getByRole('alert')).toBeVisible();expect(requests).toHaveLength(start);
 await amount.getByRole('textbox',{name:'预签金额下限',exact:true}).fill('10');await amount.getByRole('textbox',{name:'预签金额上限',exact:true}).fill('10');await amount.getByRole('button',{name:'确定',exact:true}).click();await expect(amount.getByRole('alert')).toBeVisible();expect(requests).toHaveLength(start);
 await amount.getByRole('button',{name:'100万及以上',exact:true}).click();await amount.getByRole('button',{name:'确定',exact:true}).click();await expect(table).toContainText('1000000');expect(new URL(page.url()).searchParams.get('amount.from')).toBe('1000000');
 expect(requests.at(-1).filter.metrics).toEqual([{metric_name:'ioc_amount_base_cny',metric_value_list:[1000000],operator:'>='}]);await expect(amount.locator('summary')).toContainText('100～不限万元');
});
test('currency clears amount in one commit, closes old draft and selects static USD data and workbook',async({page},info)=>{
 const requests:any[]=[];page.on('request',r=>{if(r.url().includes(endpoint)&&r.method()==='POST')requests.push(...r.postDataJSON().dsl_list);});
 await page.goto('/pages/ioc-header-currency-demo');const amount=page.locator('[data-filter-id="amount"]'),currency=page.locator('[data-filter-id="currency"]'),table=page.locator('[data-component="body/amount-table"]');
 await expect(table).toContainText('2,200,000');await amount.locator('summary').click();await amount.getByRole('button',{name:'100万及以上',exact:true}).click();await amount.getByRole('button',{name:'确定',exact:true}).click();await expect(table).toContainText('1000000');
 await amount.locator('summary').click();await amount.getByRole('textbox',{name:'预签金额下限',exact:true}).fill('999');const count=requests.length;
 await currency.getByRole('button',{name:'币种',exact:true}).click();await currency.getByRole('option',{name:'美元',exact:true}).click();await expect(amount.locator('details')).not.toHaveAttribute('open');await expect(page.locator('[data-ioc-header]')).toContainText('等待筛选确认');expect(requests).toHaveLength(count);expect(new URL(page.url()).searchParams.has('amount.from')).toBe(false);
 await amount.locator('summary').click();await expect(amount.getByRole('textbox',{name:'预签金额下限',exact:true})).toHaveValue('');await amount.getByRole('button',{name:'全部',exact:true}).click();await amount.getByRole('button',{name:'确定',exact:true}).click();
 await expect(table.getByRole('columnheader',{name:'预签金额（美元）',exact:false})).toBeVisible();await expect(table).toContainText('310,000');await expect(table).not.toContainText('2,200,000');
 const download=page.waitForEvent('download');await table.getByRole('button',{name:'导出',exact:true}).click();const file=await download;const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile((await file.path())!);const values=workbook.worksheets[0].getSheetValues();expect(JSON.stringify(values)).toContain('美元');expect(JSON.stringify(values)).toContain('310000');expect(JSON.stringify(values)).not.toContain('2200000');
 await amount.locator('summary').click();await amount.getByRole('textbox',{name:'预签金额下限',exact:true}).fill('50');await amount.getByRole('button',{name:'确定',exact:true}).click();await expect(table.getByRole('cell',{name:'甲项目',exact:true})).toHaveCount(0);await expect(table.getByRole('cell',{name:'乙项目',exact:true})).toBeVisible();expect(requests.at(-1).filter.metrics).toEqual([{metric_name:'ioc_amount_base_usd',metric_value_list:[500000],operator:'>='}]);
 await page.setViewportSize({width:390,height:850});await amount.locator('summary').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(amount.getByRole('button',{name:'确定',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('currency-390.png'),fullPage:true});
});
