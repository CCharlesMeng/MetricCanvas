import { expect, test } from '@playwright/test';
import { chooseTree, closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';

test('standard Region defaults to geo global and retains parent/child selection and clear intent', async ({ page }) => {
  await page.goto('/pages/table-hierarchy-standard-region');
  const region = page.locator('[data-filter-id="region"]');
  const trigger = region.locator('button[aria-haspopup]').first();
  await expect(trigger).toContainText('全球');
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toBeVisible();
  await chooseTree(region, '华东');
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toHaveCount(0);
  await chooseTree(region, '上海');
  await expect(page.getByRole('region', { name: '子表格', exact: true }).getByRole('cell', { name: '上海', exact: true })).toBeVisible();
  await chooseTree(region, '全球');
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/region.level=geo/);
  await openSelection(region);
  await region.getByRole('button', { name: '清空区域', exact: true }).click();
  await closeSelection(region);
  await expect(trigger).not.toContainText('全球');
  await page.reload();
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toBeVisible();
  await expect(trigger).not.toContainText('全球');
});
