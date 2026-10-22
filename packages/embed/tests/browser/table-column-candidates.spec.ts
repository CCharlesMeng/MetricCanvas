import { test, expect } from '@playwright/test';

test('uses the Dashboard layout and delivered TinyVue OS table skin', async ({ page }, testInfo) => {
  await page.goto('/pages/table-column-candidates');
  await expect(page.locator('[data-dashboard-toolbar] h1')).toHaveText('表格列筛选候选值');
  await expect(page.locator('.report-header')).toHaveCount(0);
  const table = page.locator('.table-widget').first();
  await expect(table).toHaveClass(/os-theme/);
  const header = table.locator('th').first();
  await expect(header).toHaveCSS('height', '40px');
  await expect(header).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect(header).toHaveCSS('font-weight', '600');
  await expect(table.locator('tbody td').first()).toHaveCSS('height', '48px');
  await table.locator('th[data-column-field="office"] summary').click();
  const checkbox = table.getByRole('checkbox').first();
  await expect(checkbox).toHaveCSS('width', '16px');
  await expect(checkbox).toHaveCSS('border-radius', '4px');
  await page.screenshot({ path: testInfo.outputPath('dashboard-os-table.png'), fullPage: true });
});

test('candidates cover all pages, support independent search and continuation, and retain self alternatives', async ({ page }, testInfo) => {
  await page.goto('/pages/table-column-candidates');
  const table = page.locator('.table-widget').first();
  const cell = table.locator('th[data-column-field="office"]');
  await cell.locator('summary').click();
  const menu = cell.locator('.menu');
  await expect(menu.getByRole('button', { name: '加载更多（50/64）' })).toBeVisible();
  await menu.getByRole('button', { name: '加载更多（50/64）' }).click();
  await expect(menu.getByRole('checkbox')).toHaveCount(64);
  await menu.getByRole('searchbox').fill('办事处64');
  await expect(menu.getByRole('checkbox')).toHaveCount(1);
  await menu.getByRole('checkbox', { name: '办事处64', exact: true }).check();
  await expect(table).toContainText('总条数： 1');
  await menu.getByRole('searchbox').fill('');
  await expect(menu.getByRole('button', { name: '加载更多（50/64）' })).toBeVisible();
  await expect(menu.getByRole('checkbox', { name: '办事处01', exact: true })).not.toBeChecked();
  await expect(page.locator('.table-widget').nth(1)).toContainText('总条数： 64');
  await page.screenshot({ path: testInfo.outputPath('column-candidates.png'), fullPage: true });
});

test('retains selected values when a different column removes all matches', async ({ page }, testInfo) => {
  await page.goto('/pages/table-column-candidates');
  const table = page.locator('.table-widget').first();
  const offices = table.locator('th[data-column-field="office"]');
  await offices.locator('summary').click();
  await offices.getByRole('searchbox').fill('办事处64');
  await offices.getByRole('checkbox', { name: '办事处64', exact: true }).check();
  await offices.getByRole('searchbox').fill('');
  await offices.locator('summary').click();
  const amount = table.locator('th[data-column-field="amount"]');
  await amount.locator('summary').click();
  await amount.getByRole('textbox', { name: '数值下限' }).fill('650000');
  await amount.locator('summary').click();
  await offices.locator('summary').click();
  await expect(offices.getByRole('checkbox', { name: '办事处64 已选，当前条件下无匹配' })).toBeChecked();
  await expect(table).toContainText('总条数： 0');
  await expect(page.locator('.table-widget').nth(1)).toContainText('总条数： 64');
  await page.screenshot({ path: testInfo.outputPath('column-candidates.png'), fullPage: true });
});

test('numeric dimension selections retain number identity and exclude their own restriction from candidates', async ({ page }) => {
  await page.goto('/pages/table-column-candidates');
  const table = page.locator('.table-widget').first();
  const cell = table.locator('th[data-column-field="grade"]');
  await cell.locator('summary').click();
  await cell.getByRole('checkbox', { name: '0', exact: true }).check();
  await expect(table).toContainText('总条数： 22');
  await expect(cell.getByRole('checkbox', { name: '1', exact: true })).not.toBeChecked();
  await expect(cell.getByRole('checkbox', { name: '2', exact: true })).not.toBeChecked();
  await expect(page.locator('.table-widget').nth(1)).toContainText('总条数： 64');
});
