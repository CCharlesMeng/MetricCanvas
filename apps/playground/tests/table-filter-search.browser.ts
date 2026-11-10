import { expect, test } from '@playwright/test';
import document from '../../../pages/capabilities/table/table-header-filter-search.json' with { type:'json' };

for (const kind of ['static', 'dynamic']) {
  for (const setting of ['true', 'false', 'omitted']) {
    test(`${kind} showSearch=${setting}`, async ({ page }) => {
      await page.goto(`/pages/${document.id}`);
      const table = page.locator('.table-widget').filter({has:page.getByRole('heading',{name:`${kind}-${setting}`,exact:true})});
      const header = table.locator('th[data-column-field="status"]');
      await header.locator('summary').click();
      await expect(header.getByRole('checkbox',{name:'否',exact:true})).toBeVisible();
      const search = header.getByRole('searchbox');
      await expect(header.getByRole('button',{name:'为空',exact:true})).toHaveCount(0);
      if (setting !== 'true') {
        await expect(search).toHaveCount(0);
        return;
      }
      await search.fill('否');
      await expect(header.getByRole('checkbox')).toHaveCount(1);
      await expect(table).toContainText('总条数： 4');
      await header.getByRole('checkbox',{name:'否',exact:true}).check();
      await expect(table).toContainText('总条数： 1');
      await search.fill('找不到');
      await expect(header.getByText('没有候选项',{exact:true})).toBeVisible();
      await expect(table).toContainText('总条数： 1');
      await search.fill('');
      await expect(header.getByRole('checkbox',{name:'否',exact:true})).toBeChecked();
      await header.getByRole('checkbox',{name:'全选',exact:true}).check();
      await expect(table).toContainText('总条数： 4');
    });
  }
}

test('old pages keep their dynamic candidate search without a new declaration', async ({ page }) => {
  await page.goto('/pages/table-column-candidates');
  const table = page.locator('.table-widget').first(), header = table.locator('th[data-column-field="office"]');
  await header.locator('summary').click();
  await expect(header.getByRole('searchbox')).toBeVisible();
  await header.getByRole('searchbox').fill('办事处64');
  await expect(header.getByRole('checkbox',{name:'办事处64',exact:true})).toBeVisible();
});

for (const title of ['静态枚举：不配置全选', '动态候选：不配置全选']) {
  test(`${title} still supports search and individual selection`, async ({ page }) => {
    const component = document.sections[0].components.find(component => component.props.title === title)!;
    expect(component.props.columns[1].filterable).not.toHaveProperty('showSelectAll');
    await page.goto(`/pages/${document.id}`);
    const table = page.locator('.table-widget').filter({has:page.getByRole('heading',{name:title,exact:true})});
    const header = table.locator('th[data-column-field="status"]');
    await header.locator('summary').click();
    await expect(header.getByRole('checkbox',{name:'否',exact:true})).toBeVisible();
    await expect(header.getByRole('checkbox',{name:'全选',exact:true})).toHaveCount(0);
    await header.getByRole('searchbox').fill('否');
    await header.getByRole('checkbox',{name:'否',exact:true}).check();
    await expect(table).toContainText('总条数： 1');
    await header.getByRole('searchbox').fill('');
    await expect(header.getByRole('checkbox',{name:'全选',exact:true})).toHaveCount(0);
    await header.getByRole('checkbox',{name:'否',exact:true}).uncheck();
    await expect(table).toContainText('总条数： 4');
  });
}
