import {expect,test} from '@playwright/test';

test('multi-source stage rows navigate in Playground without changing their shared join key',async({page})=>{
 for(const [index,stage] of ['代表处SDT','地区部SDT','华为云计算SDT'].entries()){
  await page.goto('/pages/table-multi-source-navigation');
  const row=page.locator('[data-component="main/stage-table"] tbody tr').nth(index+1);
  await expect(row.getByText('合成客户乙',{exact:true})).toBeVisible();
  await row.getByRole('link',{name:'12',exact:true}).click();
  await expect(page).toHaveURL(/\/pages\/table-multi-source-navigation-detail\?/);
  expect(new URL(page.url()).searchParams.get('stage-name')).toBe(stage);
  await expect(page.locator('[data-component="main/stage-name"]')).toContainText(stage);
  await expect(page.locator('[data-component="main/project-name"]')).toContainText('合成项目乙');
 }
});
