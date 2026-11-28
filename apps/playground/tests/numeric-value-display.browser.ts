import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const requireEngine = createRequire(
  new URL('../../../packages/engine/package.json', import.meta.url),
);
const ExcelJS = requireEngine('exceljs');
const { strFromU8, unzipSync } = requireEngine('fflate');

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../pages/capabilities/data/numeric-value-display.json', import.meta.url),
    'utf8',
  ),
);

test('numeric consumers omit integer fractions and share the em dash placeholder', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/pages/${fixture.id}`);
  const rows = page.locator('[data-component$="/values-table"] tbody tr');
  await expect(rows).toHaveCount(5);
  for (const [index, expected] of [
    ['整数', '50', '50%', '50万', '50', '-'],
    ['小数', '12.5', '12.5%', '12.5万', '12.5', '—'],
    ['零', '0', '0%', '0万', '0', '–'],
    ['负整数', '-12', '-12%', '-12万', '-12', '—'],
    ['缺失', '—', '—', '—', '未提供', '--'],
  ].entries()) {
    await expect(rows.nth(index).locator('td')).toHaveText(expected);
  }
  await expect(page.locator('.row-value')).toHaveText(['50%', '—']);
  await expect(page.locator('.progress-ring')).toHaveAttribute('aria-label', '完成率 —');
  await expect(page.locator('.progress-ring .value')).toHaveText('—');
  await expect(page.locator('.progress-ring .percent')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('table remarks bottom-align with the title or align left when untitled', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/pages/${fixture.id}`);

  const titled = page.locator('[data-component$="/values-table"] .table-heading');
  const title = titled.getByRole('heading', { name: '统一格式' });
  const explicitSubtitle = '— 代表本周期暂无数值';
  const remark = titled.getByText(explicitSubtitle, { exact: true });
  await expect(remark).toHaveCSS('font-size', '12px');
  await expect(remark).toHaveCSS('color', 'rgb(89, 89, 89)');
  const titleBox = (await title.boundingBox())!;
  const remarkBox = (await remark.boundingBox())!;
  expect(remarkBox.x - titleBox.x - titleBox.width).toBeCloseTo(16, 1);
  expect(remarkBox.y + remarkBox.height).toBeCloseTo(titleBox.y + titleBox.height, 1);

  const untitled = page.locator('[data-component$="/untitled-table"] .table-heading');
  const untitledRemark = untitled.getByText(explicitSubtitle, { exact: true });
  await expect(untitled.getByRole('heading')).toHaveCount(0);
  await expect(untitled.getByRole('searchbox', { name: '表格搜索' })).toBeVisible();
  expect((await untitledRemark.boundingBox())!.x).toBe((await untitled.boundingBox())!.x);

  const custom = page.locator('[data-component$="/custom-subtitle-table"] .table-heading');
  await expect(custom.getByText('数值来自内联合成数据', { exact: true })).toBeVisible();
  await expect(custom.getByText(explicitSubtitle, { exact: true })).toHaveCount(0);

  const hidden = page.locator('[data-component$="/hidden-subtitle-table"] .table-heading');
  await expect(hidden.getByRole('heading', { name: '关闭副标题' })).toBeVisible();
  await expect(hidden.locator('.subtitle')).toHaveCount(0);
});

test('downloads numeric values, literal dashes and missing cells with reusable formats', async ({
  page,
}, info) => {
  await page.goto(`/pages/${fixture.id}`);
  const table = page.locator('[data-component$="/values-table"]');
  const pending = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const path = info.outputPath('numeric-values.xlsx');
  await (await pending).saveAs(path);
  const bytes = readFileSync(path);
  const styles = strFromU8(unzipSync(bytes)['xl/styles.xml']);
  expect(Number(styles.match(/<numFmts count="(\d+)"/)?.[1])).toBeLessThan(20);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path);
  const sheet = book.worksheets[0];
  expect(sheet.getCell('D1').value).toBe('万单位（原值）');
  expect(sheet.getRow(3).values).toEqual([, '小数', 12.5, 12.5, 125000, 12.5, '—']);
  expect(sheet.getRow(4).values).toEqual([, '零', 0, 0, 0, 0, '–']);
  expect(sheet.getRow(6).values).toEqual([, '缺失', '—', , , '未提供', '--']);
  expect(sheet.getCell('C6').value).toBeNull();
  expect(sheet.getCell('F2').value).toBe('-');
  expect(sheet.getCell('F5').value).toBeNull();
});
