import { expect, test } from '@playwright/test';

test('Report region summaries stay above their own content and isolate card/Tab data', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/pages/report-ai-summary-regions');
  const runtime = page.locator('.runtime-view');
  const pageSummary = runtime.locator('[data-component="page-summary/page-ai"] .ai-summary');
  await expect(pageSummary).toContainText('comparison：2 行');
  await expect(pageSummary).toContainText('usage：2 行');
  const section = runtime.locator('[data-section-id="full-region"]');
  await expect(section.locator('.ai-summary')).toContainText('usage：2 行');
  await expect(section.locator('.ai-summary')).not.toContainText('comparison');
  const cells = section.locator('.section-grid > .cell');
  await expect(cells.first().locator('.ai-summary')).toBeVisible();
  const left = runtime.locator('[data-component="parallel/left-card"]');
  const right = runtime.locator('[data-component="parallel/right-card"]');
  await expect(left.locator('.composite-slot').first().locator('.ai-summary')).toContainText('usage：2 行');
  await expect(right.locator('.composite-slot').first().locator('.ai-summary')).toContainText('comparison：2 行');
  await expect(left.locator('.ai-summary')).not.toContainText('comparison');
  await expect(right.locator('.ai-summary')).not.toContainText('usage：');
  const leftBox = await left.boundingBox();
  const rightBox = await right.boundingBox();
  expect(leftBox!.x + leftBox!.width).toBeLessThanOrEqual(rightBox!.x + 1);
  expect(Math.abs(leftBox!.y - rightBox!.y)).toBeLessThan(2);
  const tabRegion = runtime.locator('[data-section-id="tabs-region"]');
  await expect(tabRegion.locator('.ai-summary:visible')).toContainText('usage：2 行');
  await tabRegion.getByRole('tab', { name: '对照视角' }).click();
  await expect(tabRegion.locator('.ai-summary:visible')).toContainText('comparison：2 行');
  await expect(tabRegion.locator('.ai-summary:visible')).not.toContainText('usage：');
  await expect(runtime.locator('.ai-summary:visible')).toHaveCount(5);
  for (const summary of await runtime.locator('.ai-summary').all()) {
    await expect(summary).not.toContainText('区域说明文字');
    await expect(summary).not.toContainText('unreferenced');
  }
  await page.screenshot({ path: info.outputPath('regions-desktop.png'), fullPage: true });
  await page.getByRole('heading', { name: 'AI Summary 区域组合（本地 Mock）', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('summary-flat-desktop.png') });
  await page.setViewportSize({ width: 640, height: 1000 });
  await expect(left.locator('.ai-summary')).toBeVisible();
  await expect(right.locator('.ai-summary')).toBeVisible();
  expect(await runtime.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('regions-narrow.png'), fullPage: true });
  expect(errors).toEqual([]);
});
