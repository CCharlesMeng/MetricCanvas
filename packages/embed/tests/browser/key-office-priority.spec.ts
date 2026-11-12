import {expect,test} from '@playwright/test';
import {chooseTree,closeSelection,openSelection} from './selection-actions';
const source='/pages/key-office-priority-demo';
const rows=(page:import('@playwright/test').Page)=>page.locator('tbody tr:not(:has(.empty-row))');

test('ordinary office produces an empty intersection and recovers on cancel',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(source+'?rep-office='+encodeURIComponent('南京代表处'));
  await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText('南京代表处');
  const checkbox=page.getByRole('checkbox',{name:'仅看重点国代'});
  await checkbox.check();await expect(rows(page)).toHaveCount(0);await expect(page.locator('body')).toContainText('暂无数据');
  await expect(page.locator('[data-filter-id="region"]')).toContainText('南京代表处');
  await page.screenshot({path:info.outputPath('empty-intersection.png'),fullPage:false});
  await checkbox.uncheck();await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText('南京代表处');
  expect(errors).toEqual([]);
});

test('Region changes while checked immediately narrow key-office queries',async({page})=>{
  await page.goto(source+'?key-office=true');await expect(rows(page)).toHaveCount(2);
  const region=page.locator('[data-filter-id="region"]');await chooseTree(region,'华东地区部');await closeSelection(region);
  await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText('上海代表处');
  await page.getByRole('checkbox',{name:'仅看重点国代'}).uncheck();await expect(rows(page)).toHaveCount(2);await expect(rows(page)).toContainText(['上海代表处','南京代表处']);
});

test('cross-page navigation and refresh retain the intersection and Chinese selection',async({page})=>{
  await page.goto(source+'?rep-office='+encodeURIComponent('南京代表处')+'&key-office=true');await expect(rows(page)).toHaveCount(0);
  await page.getByRole('button',{name:'切换页面',exact:true}).click();await expect(page).toHaveURL(/key-office-priority-target/);
  await expect(page.getByRole('checkbox',{name:'仅看重点国代'})).toBeChecked();await expect(rows(page)).toHaveCount(0);
  await page.reload();await expect(rows(page)).toHaveCount(0);
  await page.getByRole('checkbox',{name:'仅看重点国代'}).uncheck();await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText('南京代表处');
  const region=page.locator('[data-filter-id="region"]');await openSelection(region);await region.getByRole('button',{name:'清空Region',exact:true}).click();await closeSelection(region);
  await page.getByRole('checkbox',{name:'仅看重点国代'}).check();await expect(rows(page)).toHaveCount(2);
});

test('a complete empty membership produces an empty result instead of a broad query',async({page})=>{
  await page.goto(source+'?state=empty&key-office=true');
  await expect(page.getByRole('checkbox',{name:'仅看重点国代'})).toBeChecked();
  await expect(rows(page)).toHaveCount(0);await expect(page.locator('body')).toContainText('暂无数据');
  await page.getByRole('checkbox',{name:'仅看重点国代'}).uncheck();await expect(rows(page)).toHaveCount(4);
});

test('denied membership blocks initialization with an explicit message',async({page})=>{
  await page.goto(source+'?state=denied&key-office=true');
  await expect(page.getByRole('heading',{name:'页面加载失败'})).toBeVisible();
  await expect(page.locator('body')).toContainText('当前授权重点国代完整名单尚未就绪');
  await expect(rows(page)).toHaveCount(0);
});
