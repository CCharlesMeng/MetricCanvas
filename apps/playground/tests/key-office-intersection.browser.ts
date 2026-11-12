import {expect,test} from '@playwright/test';
import {chooseTree,closeSelection,openSelection} from '../../../packages/embed/tests/browser/selection-actions';

test('key office intersection follows Region immediately and preserves empty selections',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/pages/key-office-priority-demo?key-office=true');
  const rows=page.locator('tbody tr:not(:has(.empty-row))');
  const region=page.locator('[data-filter-id="region"]');
  const checkbox=page.getByRole('checkbox',{name:'仅看重点国代'});
  await expect(rows).toHaveCount(2);
  await chooseTree(region,'华东地区部');await closeSelection(region);
  await expect(rows).toHaveCount(1);await expect(rows).toContainText('上海代表处');
  await chooseTree(region,'南京代表处');await closeSelection(region);
  await expect(rows).toHaveCount(0);await expect(page.locator('body')).toContainText('暂无数据');
  await expect(region).toContainText('南京代表处');
  await checkbox.uncheck();await expect(rows).toHaveCount(1);await expect(rows).toContainText('南京代表处');
  await checkbox.check();await expect(rows).toHaveCount(0);
  await openSelection(region);await region.getByRole('button',{name:'清空Region',exact:true}).click();await closeSelection(region);
  await expect(rows).toHaveCount(2);await expect(checkbox).toBeChecked();
  expect(errors).toEqual([]);
});
