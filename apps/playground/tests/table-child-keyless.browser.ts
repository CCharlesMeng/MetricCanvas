import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { chooseTree, closeSelection } from '../../../packages/embed/tests/browser/selection-actions';
const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');
async function workbook(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const file = await pending, book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await file.path())!);
  return book;
}
function counts(book: InstanceType<typeof ExcelJS.Workbook>) {
  const result = [0, 0];
  expect(book.worksheets.map(sheet => sheet.name)).toEqual(['父子表格']);
  book.worksheets[0]!.eachRow((row, number) => {
    if (number === 1) return;
    if (row.getCell(1).value !== null) result[0]++;
    else if (typeof row.getCell(3).value === 'number') result[1]++;
  });
  return result;
}
test('keyless query and inline children keep duplicates, paging, folds and complete exports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/pages/table-child-keyless');
  const parent = page.locator('[data-component="hierarchy/keyless-query-table"]');
  await expect(parent.getByRole('cell', { name: '华东', exact: true })).toBeVisible();
  const initial = await workbook(page);
  expect(counts(initial)).toEqual([4, 18]);
  expect([initial.worksheets[0]!.getCell('C4').value, initial.worksheets[0]!.getCell('C5').value]).toEqual([360, 999]);
  await parent.getByRole('button', { name: '展开子表格', exact: true }).first().click();
  const child = parent.getByRole('region', { name: '子表格', exact: true });
  await expect(child.getByRole('cell', { name: '上海', exact: true })).toHaveCount(2);
  await expect(child.getByRole('cell', { name: '999', exact: true })).toBeInViewport();
  await child.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(child.getByRole('cell', { name: '江苏', exact: true })).toBeVisible();
  await parent.getByRole('button', { name: '收起子表格', exact: true }).click();
  await parent.getByRole('button', { name: '展开子表格', exact: true }).first().click();
  await expect(child.getByRole('cell', { name: '江苏', exact: true })).toBeVisible();
  await child.getByRole('searchbox').fill('上海');
  await child.getByRole('searchbox').press('Enter');
  await expect(child.getByRole('cell', { name: '上海', exact: true })).toHaveCount(2);
  expect(counts(await workbook(page))).toEqual([4, 18]);
  const region = page.locator('[data-filter-id="region"]');
  await chooseTree(region, '上海'); await closeSelection(region);
  await expect(child.getByRole('cell', { name: '上海', exact: true })).toHaveCount(2);
  expect(counts(await workbook(page))).toEqual([1, 2]);
  const inline = page.locator('[data-component="inline-keyless/keyless-inline-table"]');
  await inline.getByRole('button', { name: '展开子表格', exact: true }).click();
  await expect(inline.getByRole('cell', { name: '甲代表处', exact: true })).toHaveCount(2);
  await expect(inline.getByRole('cell', { name: '20', exact: true })).toBeVisible();
});
