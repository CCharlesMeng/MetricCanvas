import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ExcelJS = createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');

test('large XLSX exports compress in a worker and preserve every row and merged header', async ({ page }) => {
  const document = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-row-number.json', import.meta.url), 'utf8'));
  document.sections = document.sections.slice(0, 1);
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    name: `客户${index + 1}-${'导出验证'.repeat(35)}`, value: index + 0.5
  }));
  document.dataSources.records.source.rows = rows;
  const errors: string[] = [], workers: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', { document });
  }, document);
  await expect(page.getByRole('cell', { name: rows[0]!.name, exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const file = await downloaded;
  expect(await file.failure()).toBeNull();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  const sheet = workbook.worksheets[0];
  expect(sheet.rowCount).toBe(rows.length + 2);
  expect(sheet.getCell('A2').isMerged).toBe(true);
  expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 2 });
  expect(sheet.getCell('A1002').value).toBe(1000);
  expect(sheet.getCell('B3').value).toBe(rows[0]!.name);
  expect(sheet.getCell('B1002').value).toBe(rows[999]!.name);
  expect(sheet.getCell('C1002').value).toBe(999.5);
  expect(workers.some(url => url.startsWith('blob:'))).toBe(true);
  expect(errors).toEqual([]);
});
