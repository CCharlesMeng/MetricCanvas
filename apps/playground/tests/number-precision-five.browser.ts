import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/number-precision-five.json', import.meta.url), 'utf8'));

test('three to five decimals share rounding, colors and metric arrows', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/pages/${fixture.id}`);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(14);
  for (const [index, expected] of [
    [0, ['正数', '1234.123', '+1234.123', '1234.1235', '+1234.1235', '1234.12346', '+1234.12346']],
    [1, ['负数', '-1234.123', '-1234.123', '-1234.1235', '-1234.1235', '-1234.12346', '-1234.12346']],
    [2, ['去尾零', '12.3', '+12.3', '12.3', '+12.3', '12.3', '+12.3']],
    [3, ['进位', '10', '+10', '10', '+10', '10', '+10']],
    [4, ['三位正边界', '0.001', '+0.001', '0.0005', '+0.0005', '0.0005', '+0.0005']],
    [8, ['五位正边界', '0', '0', '0', '0', '0.00001', '+0.00001']],
    [9, ['五位负边界', '-0', '0', '-0', '0', '-0.00001', '-0.00001']],
    [10, ['正向舍入零', '0', '0', '0', '0', '0', '0']],
    [13, ['缺失', '--', '--', '--', '--', '--', '--']]
  ] as const) {
    await expect(rows.nth(index).locator('td')).toHaveText([...expected]);
  }
  const neutral = rows.nth(10).locator('td').nth(6);
  expect(await neutral.getAttribute('style') ?? '').not.toContain('--mc-color-negative');
  expect(await rows.nth(0).locator('td').nth(6).getAttribute('style')).toContain('--mc-color-negative');
  await expect(page.locator('.change-value')).toHaveText([
    '↑ +0.001', '↓ -0.001', '0', '↑ +0.0001', '↓ -0.0001', '0', '↑ +0.00001', '↓ -0.00001', '0'
  ]);
  await expect(page.locator('.trend-arrow')).toHaveCount(6);
  await expect(page.locator('.bar-chart')).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('precision-five.png'), fullPage: true });
});
