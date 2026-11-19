import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/numeric-value-display.json', import.meta.url), 'utf8'));

test('numeric consumers omit integer fractions and share the em dash placeholder', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/pages/${fixture.id}`);
  const rows = page.locator('[data-component$="/values-table"] tbody tr');
  await expect(rows).toHaveCount(5);
  for (const [index, expected] of [
    ['整数', '50', '50%', '50万', '50'],
    ['小数', '12.5', '12.5%', '12.5万', '12.5'],
    ['零', '0', '0%', '0万', '0'],
    ['负整数', '-12', '-12%', '-12万', '-12'],
    ['缺失', '—', '—', '—', '未提供']
  ].entries()) {
    await expect(rows.nth(index).locator('td')).toHaveText(expected);
  }
  await expect(page.locator('.row-value')).toHaveText(['50%', '—']);
  await expect(page.locator('.progress-ring')).toHaveAttribute('aria-label', '完成率 —');
  await expect(page.locator('.progress-ring .value')).toHaveText('—');
  await expect(page.locator('.progress-ring .percent')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('table remarks sit 16px after the title or align left when untitled', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/pages/${fixture.id}`);

  const titled = page.locator('[data-component$="/values-table"] .table-heading');
  const title = titled.getByRole('heading', { name: '统一格式' });
  const remark = titled.getByText('灰色备注示例', { exact: true });
  await expect(remark).toHaveCSS('font-size', '12px');
  await expect(remark).toHaveCSS('color', 'rgb(89, 89, 89)');
  const titleBox = (await title.boundingBox())!;
  const remarkBox = (await remark.boundingBox())!;
  expect(remarkBox.x - titleBox.x - titleBox.width).toBeCloseTo(16, 1);
  expect(remarkBox.y + remarkBox.height / 2).toBeCloseTo(titleBox.y + titleBox.height / 2, 1);

  const untitled = page.locator('[data-component$="/untitled-table"] .table-heading');
  const untitledRemark = untitled.getByText('无标题时从左侧显示备注', { exact: true });
  await expect(untitled.getByRole('heading')).toHaveCount(0);
  await expect(untitled.getByRole('searchbox', { name: '表格搜索' })).toBeVisible();
  expect((await untitledRemark.boundingBox())!.x).toBe((await untitled.boundingBox())!.x);
});
