import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const document = JSON.parse(readFileSync(new URL('../../../pages/capabilities/layout/local-authoring-scoped-data-demo.json', import.meta.url), 'utf8'));

test('局部接数示例保留两表共享数值、独立排序和零值', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/pages/${document.id}`);
    const first = page.locator('[data-component="voice/region-table"]');
    const second = page.locator('[data-component="voice/review-table"]');
    await expect(first.getByRole('cell', { name: '0.0%', exact: true })).toBeVisible();
    await expect(second.getByRole('cell', { name: '50.0%', exact: true })).toBeVisible();
    await expect(second.getByRole('cell', { name: '100.0%', exact: true })).toBeVisible();
    await expect(first.locator('tbody tr')).toHaveCount(document.dataSources['voice-closure'].source.rows.length);
    await first.getByRole('button', { name: '伙伴声音闭环率', exact: true }).click();
    await expect(first.locator('tbody tr').first()).toContainText('南区');
    await expect(second.locator('tbody tr').first()).toContainText('东区');
    await expect(page.locator('[data-component="independent/other-card"]')).toContainText('999');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`scoped-data-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});
