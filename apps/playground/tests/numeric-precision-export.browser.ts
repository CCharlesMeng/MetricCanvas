import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';

const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');

test('basic precision is consistent on screen and exported numeric cells remain editable', async ({ page }) => {
  await page.goto('/pages/numeric-precision-export');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(6);
  await expect(rows.nth(0).locator('td')).toHaveText(['整数', '50', '50', '50', '50', '50', '50', '50', '+50', '50']);
  await expect(rows.nth(1).locator('td')).toHaveText(['小数', '12.345678', '12', '12.3', '12.35', '12.346', '12.3457', '12.34568', '+12.346', '12.346']);
  await expect(rows.nth(3).locator('td:nth-child(n+3)')).toHaveText(['0', '0', '0', '0', '0', '0', '0', '0']);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = await pending;
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile((await download.path())!);
  const sheet = book.worksheets[0]!;
  for (const [index, format] of ['0', '0.#;-0.#;0', '0.##;-0.##;0', '0.###;-0.###;0', '0.####;-0.####;0', '0.#####;-0.#####;0'].entries()) {
    const cell = sheet.getCell(3, index + 3);
    expect(cell.value).toBe(12.345678);
    expect(cell.type).toBe(ExcelJS.ValueType.Number);
    expect(cell.numFmt).toBe(format);
    cell.value = 50;
    expect(cell.numFmt).toBe(format);
  }
});
