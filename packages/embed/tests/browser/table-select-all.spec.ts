import {test,expect} from '@playwright/test';

for(const title of ['静态候选：显示全选','动态候选：显示全选']){
  test(`built embed selects all including null: ${title}`,async({page})=>{
    await page.goto('/pages/table-header-select-all');
    const table=page.locator('.table-widget').filter({has:page.getByRole('heading',{name:title,exact:true})});
    const column=table.locator('th[data-column-field="status"]');await column.locator('summary').click();
    const all=column.getByRole('checkbox',{name:'全选',exact:true});
    await all.click();await expect(all).toBeChecked();await expect(table).toContainText('总条数： 4');
    await column.getByRole('checkbox',{name:'否',exact:true}).uncheck();
    await expect(all).not.toBeChecked();await expect(table).toContainText(title.startsWith('静态')?'总条数： 1':'总条数： 2');
  });
}
