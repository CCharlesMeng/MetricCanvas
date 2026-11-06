import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/numeric-value-display.json', import.meta.url), 'utf8'));

test('numeric consumers omit integer fractions and share adjacent missing text', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/pages/${fixture.id}`);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(5);
  for (const [index, expected] of [
    ['整数', '50', '50%', '50万', '50'],
    ['小数', '12.5', '12.5%', '12.5万', '12.5'],
    ['零', '0', '0%', '0万', '0'],
    ['负整数', '-12', '-12%', '-12万', '-12'],
    ['缺失', '--', '--', '--', '未提供']
  ].entries()) {
    await expect(rows.nth(index).locator('td')).toHaveText(expected);
  }
  await expect(page.locator('.row-value')).toHaveText(['50%', '--']);
  await expect(page.locator('.progress-ring')).toHaveAttribute('aria-label', '完成率 --');
  await expect(page.locator('.progress-ring .value')).toHaveText('--');
  await expect(page.locator('.progress-ring .percent')).toHaveCount(0);
  expect(errors).toEqual([]);
});
