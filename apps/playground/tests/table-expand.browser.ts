import { expect, test } from '@playwright/test';

test('table expands across its row and keeps its sort and neighboring rows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pages/table-expand');
  const grid = page.locator('[data-section-id="regions"] > .section-grid');
  const table = page.locator('[data-component="regions/details"]');
  const peer = page.getByText('同行说明', { exact: true });
  const firstRow = table.getByRole('row').nth(1);
  const expand = table.getByRole('button', { name: '放大表格' });
  await expect(expand).toBeVisible();
  await expect(peer).toBeVisible();
  const initialWidth = (await table.boundingBox())!.width;
  const gridWidth = (await grid.boundingBox())!.width;
  expect(initialWidth / gridWidth).toBeLessThan(0.3);

  await table.getByRole('button', { name: '金额' }).click();
  await expect(firstRow).toContainText('亚太');
  await expand.click();
  const restore = table.getByRole('button', { name: '还原表格' });
  await expect(restore).toBeFocused();
  await expect(restore).toHaveAttribute('aria-expanded', 'true');
  await expect(peer).toBeHidden();
  await expect(page.getByText('地区总览', { exact: true })).toBeVisible();
  await expect(page.getByText('下一行内容', { exact: true })).toBeVisible();
  expect((await table.boundingBox())!.width).toBeCloseTo(gridWidth, 0);
  await expect(firstRow).toContainText('亚太');

  await restore.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(peer).toBeVisible();
  expect((await table.boundingBox())!.width).toBeCloseTo(initialWidth, 0);
  await expect(firstRow).toContainText('亚太');
});

test('a stacked table is already full width', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await page.goto('/pages/table-expand');
  await expect(page.getByRole('heading', { name: '地区指标明细' })).toBeVisible();
  await expect(page.getByRole('button', { name: '放大表格' })).toHaveCount(0);
  await expect(page.getByText('同行说明', { exact: true })).toBeVisible();
});
