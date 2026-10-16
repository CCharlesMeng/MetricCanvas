import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`${width}: report title follows applied month, range and clear`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/pages/report-title-filter-example');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText('2026-09 经营分析报告');
    const month = page.getByRole('combobox', { name: '报告月份', exact: true });
    await month.fill('2026-10');
    await expect(title).toHaveText('2026-09 经营分析报告'); // unapplied input draft
    await month.press('Enter');
    await expect(title).toHaveText('2026-10 经营分析报告');
    await page.getByRole('combobox', { name: '对照期间开始' }).fill('2026-02');
    const end = page.getByRole('textbox', { name: '对照期间结束' });
    await end.fill('2026-04');
    await end.press('Enter');
    await expect(page.locator('.as-of')).toHaveText('对照期间：2026-02 至 2026-04 对照分析');
    await expect(page.getByText('当前：2026-10；对照：2026-02 至 2026-04', { exact: true })).toBeVisible();
    await end.fill('2026-02');
    await end.press('Enter');
    await expect(page.locator('.as-of')).toHaveText('对照期间：2026-02 对照分析');
    // Export assertions run through the configured Report PDF action (report-pdf.spec.ts).
    expect(await page.evaluate(() => 'withExportView' in window.runtime)).toBe(false);
    await month.hover();
    await page.getByRole('button', { name: '清除时间点', exact: true }).click();
    await expect(title).toHaveText('全部期间 经营分析报告');
    await expect(page.locator('.subtitle-content, .heading > p')).toContainText('打开时名称：经营分析报告；已应用月份：全部期间');
    const overflow = await title.evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('report-title.png'), fullPage: true });
  });
}
