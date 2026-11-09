import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/table/table-time-format.json', import.meta.url), 'utf8'));

test('time format renders UTC+8 independently of browser timezone and exports it', async ({ page }) => {
  await page.goto(`/pages/${fixture.id}`);
  const table = page.locator('[data-component="main/times"]');
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(10);
  for (let index = 0; index < 7; index++) {
    await expect(rows.nth(index).locator('td').nth(1)).toHaveText('2026-11-10 02:30:00');
    await expect(rows.nth(index).locator('td').nth(2)).toHaveText('2026/11/10');
  }
  for (const [column, expected] of [[3, '2026-11-10'], [4, '2026-11-10 02:30'], [5, '02:30:00'], [6, '2026年11月10日']] as const) {
    await expect(rows.first().locator('td').nth(column)).toHaveText(expected);
  }
  await expect(rows.nth(7).locator('td').nth(1)).toHaveText('2027-01-01 02:30:00');
  await expect(rows.nth(8).locator('td').nth(1)).toHaveText('2026-02-30T18:30:00Z');
  await expect(rows.nth(9).locator('td').nth(1)).toHaveText('--');
  const pending = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('time-format.xlsx');
  await download.saveAs('/tmp/mc-table-time-format.xlsx');
});
