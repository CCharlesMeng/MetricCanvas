import { expect, test } from '@playwright/test';
import { chooseTree, closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';

test('standard Region defaults to geo global and retains parent/child selection and clear intent', async ({ page }) => {
  await page.goto('/pages/table-hierarchy-standard-region');
  const region = page.locator('[data-filter-id="region"]');
  const trigger = region.locator('button[aria-haspopup]').first();
  const child = page.getByRole('region', { name: '子表格', exact: true });
  await expect(trigger).toContainText('全球');
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toBeVisible();
  await expect(child).toHaveCount(0);
  await chooseTree(region, '华东');
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toHaveCount(0);
  await expect(child.getByRole('cell', { name: '上海', exact: true })).toBeVisible();
  await expect(child.getByRole('cell', { name: '江苏', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '收起子表格', exact: true }).click();
  await expect(child).toHaveCount(0);
  const year = page.locator('[data-filter-id="year"]');
  await openSelection(year);
  await year.getByRole('option', { name: '2025', exact: true }).click();
  await closeSelection(year);
  await expect(page.getByRole('cell', { name: '960', exact: true })).toBeVisible();
  await expect(child.getByRole('cell', { name: '江苏', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '收起子表格', exact: true }).click();
  await page.reload();
  await expect(child.getByRole('cell', { name: '江苏', exact: true })).toBeVisible();
  await chooseTree(region, '上海');
  await expect(child.getByRole('cell', { name: '上海', exact: true })).toBeVisible();
  await expect(child.getByRole('cell', { name: '江苏', exact: true })).toHaveCount(0);
  await chooseTree(region, '全球');
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toBeVisible();
  await expect(child).toHaveCount(0);
  await expect(page).toHaveURL(/region.level=geo/);
  await openSelection(region);
  await region.getByRole('button', { name: '清空区域', exact: true }).click();
  await closeSelection(region);
  await expect(trigger).not.toContainText('全球');
  await page.reload();
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toBeVisible();
  await expect(trigger).not.toContainText('全球');
});

test('an empty parent lookup uses the table empty state and a valid selection restores the rows', async ({ page }) => {
  await page.goto('/pages/table-hierarchy-standard-region?rep-office=O-empty');
  const table = page.locator('[data-component="hierarchy/region-office-table"]');
  const child = table.getByRole('region', { name: '子表格', exact: true });
  await expect(table.getByRole('columnheader', { name: '地区部', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: '暂无数据', exact: true })).toBeVisible();
  await expect(table).toContainText('总条数： 0');
  await expect(table.getByRole('alert')).toHaveCount(0);
  await expect(child).toHaveCount(0);

  await chooseTree(page.locator('[data-filter-id="region"]'), '上海');
  await expect(child.getByRole('cell', { name: '上海', exact: true })).toBeVisible();
});

for (const [office, reason] of [['O-multi', '所选子级的父级归属不唯一'], ['O-error', '父级定位查询失败或无权限']] as const) {
  test(`parent lookup for ${office} keeps the empty table and reports the reason to diagnostics`, async ({ page }) => {
    const diagnostics: string[] = [];
    page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
    await page.goto(`/pages/table-hierarchy-standard-region?rep-office=${office}`);
    const table = page.locator('[data-component="hierarchy/region-office-table"]');
    await expect(table.getByRole('columnheader', { name: '地区部', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: '暂无数据', exact: true })).toBeVisible();
    await expect(table.getByRole('alert')).toHaveCount(0);
    await expect(table.getByRole('region', { name: '子表格' })).toHaveCount(0);
    await expect.poll(() => diagnostics.some(message => message.includes(reason))).toBe(true);
  });
}
