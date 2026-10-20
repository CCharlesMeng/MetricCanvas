import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('packaged runtime renders static search options and submits the new field immediately', async ({ page }) => {
  const document = JSON.parse(readFileSync(new URL('../../../../pages/table-search-options-demo.json', import.meta.url), 'utf8'));
  // Keep the acceptance page's interaction declarations; this smoke test exercises its inline table.
  document.sections[0].components = [document.sections[0].components[0]];
  delete document.dataSources.queried;
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document });
  }, document);
  const table = page.locator('[data-component="main/local-table"]');
  await table.getByRole('searchbox').fill('星河项目');
  await table.getByRole('searchbox').press('Enter');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await table.getByRole('button', { name: '表格搜索字段' }).click();
  await page.getByRole('option', { name: '责任人', exact: true }).click();
  await expect(table.getByRole('cell', { name: '其他项目', exact: true })).toBeVisible();
  await expect(table.getByRole('searchbox')).toHaveAttribute('placeholder', '请输入完整责任人姓名');
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table.getByRole('button', { name: '表格搜索字段' })).toHaveText('责任人');
  await expect(table.locator('tbody tr')).toHaveCount(2);
});

test('static search options respect the existing toolbar execution condition', async ({ page }) => {
  const document = JSON.parse(readFileSync(new URL('../../../../pages/table-search-options-demo.json', import.meta.url), 'utf8'));
  document.sections[0].components = [document.sections[0].components[0]];
  document.sections[0].components[0].props.toolbar.search.enabledWhen = { permission: 'search' };
  delete document.dataSources.queried;
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document, displayInputs: {
      getSnapshot: () => ({ permissionRevision: 'disabled-search', permissions: { search: { status: 'ready' as const, value: false } }, values: {} }),
      subscribe: () => () => {}
    } });
  }, document);
  const table = page.locator('[data-component="main/local-table"]');
  await expect(table.getByRole('button', { name: '表格搜索字段' })).toBeDisabled();
  await expect(table.getByRole('searchbox')).toBeDisabled();
  await expect(table.getByRole('button', { name: '搜索', exact: true })).toBeDisabled();
  await expect(table.locator('tbody tr')).toHaveCount(2);
});
