import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { chooseTree, closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';

const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');

async function exportCounts(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = await pending;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['父子表格']);
  const sheet = workbook.worksheets[0]!, counts = [0, 0];
  expect(sheet.getCell('A1').value).toBe('地区部');
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    if (row.getCell(1).value !== null) counts[0]++;
    else if (typeof row.getCell(3).value === 'number') counts[1]++;
  });
  return counts;
}

test('exports complete children before expansion and ignores child-local paging and search', async ({ page }) => {
  await page.goto('/pages/table-hierarchy-selection');
  await expect(page.getByRole('cell', { name: '华东', exact: true })).toBeVisible();
  expect(await exportCounts(page)).toEqual([4, 17]);
  await page.getByRole('button', { name: '展开子表格', exact: true }).first().click();
  const child = page.getByRole('region', { name: '子表格', exact: true });
  await expect(child.getByRole('cell', { name: '上海', exact: true })).toBeVisible();
  await child.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(child.getByRole('cell', { name: '浙江', exact: true })).toBeVisible();
  expect(await exportCounts(page)).toEqual([4, 17]);
  await child.getByRole('searchbox').fill('上海');
  await child.getByRole('searchbox').press('Enter');
  await expect(child.getByRole('cell', { name: '上海', exact: true })).toBeVisible();
  expect(await exportCounts(page)).toEqual([4, 17]);
  const region = page.locator('[data-filter-id="region"]');
  await chooseTree(region, '上海');
  await closeSelection(region);
  await expect(page.getByRole('cell', { name: '上海', exact: true })).toBeVisible();
  expect(await exportCounts(page)).toEqual([1, 1]);
  await openSelection(region);
  await region.getByRole('button', { name: '清空地区范围', exact: true }).click();
  await closeSelection(region);
  await expect(page.getByRole('cell', { name: '中国区', exact: true })).toBeVisible();
  expect(await exportCounts(page)).toEqual([4, 17]);
});

test('IOC global restores every parent and complete Excel after a region or office selection',async({page})=>{
  await page.goto('/pages/table-hierarchy-selection');
  const region=page.locator('[data-filter-id="region"]');
  await chooseTree(region,'华东');
  await expect(page.getByRole('cell',{name:'华东',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'中国区',exact:true})).toHaveCount(0);
  expect(await exportCounts(page)).toEqual([1,5]);
  await chooseTree(region,'全球');
  await expect(page.getByRole('cell',{name:'中国区',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/region-dept=%E5%85%A8%E7%90%83/);
  expect(await exportCounts(page)).toEqual([4,17]);
  await chooseTree(region,'上海');
  await expect(page.getByRole('cell',{name:'上海',exact:true})).toBeVisible();
  expect(await exportCounts(page)).toEqual([1,1]);
  await chooseTree(region,'全球');
  await expect(page.getByRole('cell',{name:'中国区',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'子表格',exact:true})).toHaveCount(0);
  expect(await exportCounts(page)).toEqual([4,17]);
});
