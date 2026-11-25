import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ExcelJS = createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');

test('compares the unrounded P value to 500 and keeps numeric Excel cells', async ({ page }) => {
  await page.goto('/pages/yoy-p-format-demo');
  const table = page.locator('[data-component="comparison/yoy-table"]');
  const expected = ['+12P', '-6P', '+29P', '0P', '0P', '+1P', '-1P', '0P', '—', '+500P', '-500P', '>500P', '<-500P'];
  for (const field of ['yoy', 'defaultYoy']) {
    await expect(table.locator(`tbody td[data-column-field="${field}"]`)).toHaveText(expected);
  }

  const downloaded = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const download = await downloaded;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path())!);
  const sheet = workbook.worksheets[0];
  expect(sheet.getCell('C13').value).toBe(5.001);
  expect(sheet.getCell('C13').numFmt).toBe('\">500P\"');
  expect(sheet.getCell('C14').value).toBe(-5.001);
  expect(sheet.getCell('C14').numFmt).toBe('\"<-500P\"');
});
