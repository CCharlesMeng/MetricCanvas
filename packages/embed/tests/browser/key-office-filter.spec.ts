import {expect,test} from '@playwright/test';
import {openSelection,closeSelection,chooseTree} from './selection-actions';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source='/pages/key-office-filter-demo';
const rows=(page:import('@playwright/test').Page)=>page.locator('#dashboard tbody tr');
async function chooseRegion(page:import('@playwright/test').Page){
 const region=page.locator('[data-filter-id="region"]');await openSelection(region);
 await region.getByRole('button',{name:'地区 A',exact:true}).click();await closeSelection(region);
}

test('checkbox gate, boolean candidates, query rows and frozen XLSX agree',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(source);const checkbox=page.getByRole('checkbox',{name:'仅看重点国代'});
 await expect(checkbox).toBeDisabled();await chooseRegion(page);await expect(checkbox).toBeEnabled();await expect(rows(page)).toHaveCount(2);
 await checkbox.check();await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText('A1');
 for(const width of [1440,390]){await page.setViewportSize({width,height:720});await expect(checkbox).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath(`key-office-${width}.png`),fullPage:false});}
 await page.setViewportSize({width:1440,height:720});
 const office=page.locator('[data-filter-id="region"]');await openSelection(office);await office.getByRole('button',{name:'展开地区 A',exact:true}).click();await expect(office.getByRole('button',{name:'代表处 A1',exact:true})).toBeVisible();await expect(office.getByRole('button',{name:'代表处 A2',exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('region-tree.png'),fullPage:false});await closeSelection(office);
 const requests=await page.evaluate(()=>(window as any).keyOfficeRequests);
 expect(requests.some((e:any)=>e.kind==='candidates'&&e.request.constraints.booleans?.['key-office']===true)).toBe(true);
 expect(requests.some((e:any)=>e.kind==='query'&&e.request.filterValues.some((v:any)=>v.queryField==='demo_key_office'&&v.values[0]==='true'))).toBe(true);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出',exact:true}).click();const download=await downloadPromise;
 const filename=await download.path();expect(filename).toBeTruthy();const ExcelJS=require('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(readFileSync(filename!));const values:unknown[]=[];workbook.eachSheet((sheet:any)=>sheet.eachRow((row:any)=>values.push(row.values)));expect(JSON.stringify(values)).toContain('A1');expect(JSON.stringify(values)).not.toContain('A2');
 await checkbox.uncheck();await expect(rows(page)).toHaveCount(2);await openSelection(office);await expect(office.getByRole('button',{name:'代表处 A2',exact:true})).toBeVisible();await closeSelection(office);

 expect(errors).toEqual([]);
});

test('host retains true, explicit false and month through mount navigation and return',async({page})=>{
 await page.goto(source);await chooseRegion(page);const checkbox=page.getByRole('checkbox',{name:'仅看重点国代'});await checkbox.check();
 const month=page.locator('[data-filter-id="mtime"] input').first();await month.fill('2026-09');await month.press('Enter');
 await page.getByRole('button',{name:'切换页面'}).click();await expect(page).toHaveURL(/key-office-filter-target/);await expect(checkbox).toBeChecked();await expect(month).toHaveValue('2026-09');await expect(rows(page)).toHaveCount(1);
 await checkbox.uncheck();await page.getByRole('button',{name:'切换页面'}).click();await expect(page).toHaveURL(/key-office-filter-demo/);await expect(checkbox).not.toBeChecked();await expect(rows(page)).toHaveCount(2);
 await checkbox.check();await page.goto('/pages/key-office-filter-target?key-office=false');await expect(checkbox).not.toBeChecked();await expect(rows(page)).toHaveCount(2);
});

test('losing an existing office selection waits for confirmation without broadening',async({page})=>{
 await page.goto(source);await chooseRegion(page);const office=page.locator('[data-filter-id="region"]');await chooseTree(office,'代表处 A2');await closeSelection(office);await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText('A2');
 await page.getByRole('checkbox',{name:'仅看重点国代'}).check();await expect(page.getByRole('button',{name:'导出',exact:true})).toBeDisabled();await expect(page.locator('[data-ioc-header]')).toContainText('等待筛选确认');
 await chooseTree(office,'地区 A');await closeSelection(office);await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText('A1');await expect(page.getByRole('button',{name:'导出',exact:true})).toBeEnabled();
});

test('clearing the region disables editing and preserves an already applied true',async({page})=>{
 await page.goto(source);await chooseRegion(page);const checkbox=page.getByRole('checkbox',{name:'仅看重点国代'});await checkbox.check();const region=page.locator('[data-filter-id="region"]');await openSelection(region);await region.getByRole('button',{name:'清空Region',exact:true}).click();await closeSelection(region);await expect(checkbox).toBeChecked();await expect(checkbox).toBeDisabled();
});

test('lost Region selection is confirmed inside the same tree dropdown',async({page})=>{
 await page.goto(source);const region=page.locator('[data-filter-id="region"]');
 await chooseTree(region,'代表处 A2');await closeSelection(region);await expect(rows(page)).toContainText('A2');
 await page.getByRole('checkbox',{name:'仅看重点国代'}).check();
 await expect(page.getByRole('button',{name:'导出',exact:true})).toBeDisabled();
 await expect(region.getByRole('button',{name:'确认不限',exact:true})).toHaveCount(0);
 await openSelection(region);await region.getByRole('button',{name:'清除筛选',exact:true}).click();await closeSelection(region);
 await expect(rows(page)).toHaveCount(2);await expect(rows(page)).toContainText(['A1','B1']);
 await expect(page.getByRole('button',{name:'导出',exact:true})).toBeEnabled();
});
