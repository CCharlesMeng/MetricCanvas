import { expect, test, type Locator } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');
const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/table/table-long-text.json', import.meta.url), 'utf8'));
const sourceRows: { id: string; opinion: string | null }[] = fixture.dataSources.opinions.source.rows;
const longText = sourceRows[0]!.opinion!;
const shortText = sourceRows.find(row => row.id === '未配置导航')!.opinion!;

async function textMetrics(cell: Locator) {
  return cell.locator('.cell-text').evaluate(element => ({
    width: element.getBoundingClientRect().width,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflow: getComputedStyle(element).overflow,
    textOverflow: getComputedStyle(element).textOverflow,
    whiteSpace: getComputedStyle(element).whiteSpace
  }));
}

async function hoverText(text: Locator) {
  // Center the value below the sticky page header before moving the pointer.
  await text.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await text.page().evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await text.hover();
}

for (const id of ['default', 'embedded', 'forecast-matrix', 'report-compact', 'link-fallback']) {
  test(`${id}: plain text has width, truncates overflow, reveals full text and exports it`, async ({ page }) => {
    await page.goto(`/pages/${fixture.id}`);
    const table = page.locator(`[data-component="main/${id}"]`);
    const longCell = table.locator('tbody tr').first().locator('td[data-column-field="opinion"]');
    const longValue = longCell.locator('.cell-text');
    await expect(longValue).toHaveText(longText);
    const metrics = await textMetrics(longCell);
    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics).toMatchObject({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    await hoverText(longValue);
    const tooltip = longCell.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(longText);
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();

    const shortCell = table.locator('tbody tr').filter({ hasText: '未配置导航' }).locator('td[data-column-field="opinion"]');
    await expect(shortCell.locator('.cell-text')).toHaveText(shortText);
    const shortMetrics = await textMetrics(shortCell);
    expect(shortMetrics.width).toBeGreaterThan(0);
    expect(shortMetrics.scrollWidth).toBeLessThanOrEqual(shortMetrics.clientWidth);
    await hoverText(shortCell.locator('.cell-text'));
    await expect(shortCell.getByRole('tooltip')).toBeHidden();

    if (id === 'link-fallback') {
      await expect(longCell.locator('a, button')).toHaveCount(0);
      const linked = table.locator('tbody tr').filter({ hasText: '短意见' }).locator('td[data-column-field="opinion"] a');
      await expect(linked).toHaveText('同意，按流程执行。');
      await expect(linked).toHaveAttribute('href', /\/pages\/table-long-text/);
    }

    const pending = page.waitForEvent('download');
    await table.getByRole('button', { name: '导出', exact: true }).click();
    const download = await pending;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile((await download.path())!);
    const sheet = workbook.worksheets[0]!;
    expect(sheet.getCell('B1').value).toBe('审批意见');
    for (const [index, row] of sourceRows.entries()) {
      expect(sheet.getCell(index + 2, 2).value).toBe(row.opinion);
    }
  });
}
