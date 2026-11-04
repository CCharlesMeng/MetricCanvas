import { expect, test } from '@playwright/test';

test('same field names across table slots retain independent rendered columns', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/pages/relay-multislot-presentation');
  const table = page.locator('.runtime-view [data-component="main/comparison"] table');
  await expect(table.locator('tbody > tr')).toHaveCount(2);
  await expect(table.locator('thead th')).toHaveCount(3);
  await expect(table.locator('colgroup col')).toHaveCount(3);
  expect(await table.locator('thead th').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-column-index')))).toEqual(['0', '1', '2']);
  await expect(table.locator('thead th.last-column')).toHaveCount(1);
  await expect(table.locator('thead th').nth(2)).toHaveClass(/last-column/);
  const rows = table.locator('tbody > tr');
  await expect(rows.nth(0).locator('td')).toHaveText(['a', '2.0百万', '—']);
  await expect(rows.nth(1).locator('td')).toHaveText(['b', '3.0百万', '1.0百万']);
  expect(await rows.nth(1).locator('td').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-column-index')))).toEqual(['0', '1', '2']);
  await page.screenshot({ path: info.outputPath('same-field-slots.png'), fullPage: true });
  expect(errors).toEqual([]);
});
