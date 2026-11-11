import {readFileSync} from 'node:fs';
import {expect,test,type Locator,type Page} from '@playwright/test';
const example=JSON.parse(readFileSync(new URL('../../../pages/capabilities/table/table-header-select-all.json',import.meta.url),'utf8'));
const tableOf=(page:Page,title:string)=>page.locator('.table-widget').filter({has:page.getByRole('heading',{name:title,exact:true})});
async function openField(table:Locator,field:string){
  const column=table.locator(`th[data-column-field="${field}"]`);
  if(await column.locator('details').getAttribute('open')===null)await column.locator('summary').click();
  return column;
}
for(const title of ['静态候选：显示全选','动态候选：显示全选','Tab 内动态全选']){
  test(`${title}: explicit all includes null and can be cancelled`,async({page})=>{
    await page.goto(`/pages/${example.id}`);
    const table=tableOf(page,title),column=await openField(table,'status');
    const all=column.getByRole('checkbox',{name:'全选',exact:true});
    await expect(column.getByRole('button',{name:'清除筛选',exact:true})).toHaveCount(0);
    await expect(all).toHaveJSProperty('indeterminate',true);
    await all.click();await expect(all).toBeChecked();await expect(table).toContainText('总条数： 4');
    await expect(column.getByRole('button',{name:'清除筛选',exact:true})).toHaveCount(0);
    await column.locator('summary').click();await table.getByRole('button',{name:'下一页',exact:true}).click();
    await expect(table.getByRole('cell',{name:'D',exact:true})).toBeVisible();
    if(title==='Tab 内动态全选'){
      await page.getByRole('tab',{name:'其他面板',exact:true}).click();
      await page.getByRole('tab',{name:'参数明细',exact:true}).click();
    }
    await openField(table,'status');await expect(all).toBeChecked();await all.click();
    await expect(all).not.toBeChecked();await expect(table).toContainText('总条数： 4');
    await expect(column.getByRole('button',{name:'清除筛选',exact:true})).toHaveCount(0);
    await column.getByRole('checkbox',{name:'是',exact:true}).check();await expect(table).toContainText('总条数： 1');
    await expect(column.getByRole('button',{name:'清除筛选',exact:true})).toHaveCount(0);
  });
}
test('false and omission hide all and retain value-set filtering',async({page})=>{
  await page.goto(`/pages/${example.id}`);
  for(const title of ['省略开关：不显示全选','false：不显示全选']){
    const table=tableOf(page,title),column=await openField(table,'status');
    await expect(column.getByRole('checkbox',{name:'全选',exact:true})).toHaveCount(0);
    await column.getByRole('checkbox',{name:'否',exact:true}).check();await expect(table).toContainText('总条数： 2');
    await expect(column.getByRole('button',{name:'清除筛选',exact:true})).toHaveCount(0);
    await column.locator('summary').click();
  }
});
test('dynamic all preserves another column and cancelling clears stale selections',async({page})=>{
  await page.goto(`/pages/${example.id}`);
  const table=tableOf(page,'动态候选：显示全选'),status=await openField(table,'status');
  await status.getByRole('checkbox',{name:'全选',exact:true}).click();await status.locator('summary').click();
  const area=await openField(table,'area');await area.getByRole('checkbox',{name:'东区',exact:true}).check();
  await expect(table).toContainText('总条数： 3');await area.locator('summary').click();
  await openField(table,'status');const all=status.getByRole('checkbox',{name:'全选',exact:true});
  await expect(status.getByRole('checkbox',{name:/待定/})).toHaveCount(0);
  await expect(all).toBeChecked();await all.click();await expect(all).not.toBeChecked();await expect(table).toContainText('总条数： 3');
});
test('checking the last complete dynamic candidate also means unrestricted',async({page})=>{
  await page.goto(`/pages/${example.id}`);
  const table=tableOf(page,'动态候选：显示全选'),column=await openField(table,'status');
  await column.getByRole('checkbox',{name:'否',exact:true}).check();await expect(table).toContainText('总条数： 2');
  await column.getByRole('checkbox',{name:'待定',exact:true}).check();
  await expect(column.getByRole('checkbox',{name:'全选',exact:true})).toBeChecked();await expect(table).toContainText('总条数： 4');
});
test('legacy allBehavior keeps its original schema and behavior',async({page})=>{
  await page.goto('/pages/table-header-filter-defaults?is-valid=是');
  const table=tableOf(page,'参数初值（全选不限）'),column=await openField(table,'is-valid');
  await expect(column.getByRole('checkbox',{name:'全选',exact:true})).toHaveCount(0);
  await column.getByRole('checkbox',{name:'否',exact:true}).check();await expect(table).toContainText('总条数： 4');
  await expect(column.getByRole('checkbox',{name:'是',exact:true})).not.toBeChecked();
});
test('an empty non-null candidate list can still select all null rows',async({page})=>{
  await page.goto(`/pages/${example.id}`);
  const table=tableOf(page,'仅空值：全选仍不限'),column=await openField(table,'status');
  const all=column.getByRole('checkbox',{name:'全选',exact:true});
  await expect(all).toBeEnabled();await all.click();await expect(all).toBeChecked();
  await expect(table).toContainText('总条数： 1');await expect(table.getByRole('cell',{name:'E',exact:true})).toBeVisible();
  await expect(column.locator('.selected')).toHaveCount(0);
});
test('remote dynamic all waits for complete candidate pages and stays outside search',async({page})=>{
  await page.goto('/pages/table-header-select-all-query');
  const table=page.locator('.table-widget'),column=await openField(table,'office');
  const all=column.getByRole('checkbox',{name:'全选',exact:true});
  await expect(all).toBeDisabled();await column.locator('.list').hover();await page.mouse.wheel(0,2000);
  await expect(all).toBeEnabled();await all.click();await expect(all).toBeChecked();
  await expect(table).toContainText('总条数： 620');
  await column.getByRole('searchbox').fill('办事处80');await expect(all).toHaveCount(0);
  await column.getByRole('searchbox').fill('');await expect(all).toBeEnabled();
  await column.locator('.list').hover();await page.mouse.wheel(0,2000);await expect(all).toBeChecked();
  await all.click();await expect(all).not.toBeChecked();await expect(table).toContainText('总条数： 620');
});
