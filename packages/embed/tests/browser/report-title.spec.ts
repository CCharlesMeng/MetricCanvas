import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`${width}: report title follows applied month, range and clear`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/pages/report-date-filter-example');
    const header = page.locator('[data-component="title-composition/title-header"]');
    const title = header.getByRole('heading', { level: 1 });
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
    await expect(header.locator('.as-of')).toHaveText('对照期间：2026-02 至 2026-04 对照分析');
    await expect(page.getByText('当前：2026-10；对照：2026-02 至 2026-04', { exact: true })).toBeVisible();
    await end.fill('2026-02');
    await end.press('Enter');
    await expect(header.locator('.as-of')).toHaveText('对照期间：2026-02 对照分析');
    // Export assertions run through the configured Report PDF action (report-pdf.spec.ts).
    expect(await page.evaluate(() => 'withExportView' in window.runtime)).toBe(false);
    await month.hover();
    await page.getByRole('button', { name: '清除时间点', exact: true }).click();
    await expect(title).toHaveText('全部期间 经营分析报告');
    await expect(header.locator('.subtitle-content, .heading > p')).toContainText('打开时名称：经营分析报告；已应用月份：全部期间');
    const overflow = await title.evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('report-title.png'), fullPage: true });
  });
}

test('consolidated report keeps text and bounded inputs independent of the query range', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T12:00:00+08:00') });
  const requests: any[] = [];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items = route.request().postDataJSON().dsl_list;
    requests.push(...items);
    await route.fulfill({ json: { retCode: 'CBC.0000', results: items.map(() => ({
      code: 'SUCCESS', data: [{ '统计周期': '2026-02', 'Tokens消耗量': 42 }], total_count: 1
    })) } });
  });
  await page.goto('/pages/report-date-filter-example');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].filter.time).toMatchObject({ start: '2026-01', end: '2026-06' });
  const month = page.getByRole('combobox', { name: '报告月份', exact: true });
  await month.fill('2026-08'); await month.press('Enter');
  await expect(page.getByRole('heading', { name: '2026-08 经营分析报告', exact: true })).toBeVisible();
  const bounded = page.getByRole('combobox', { name: '受限月份', exact: true });
  await bounded.fill('2026-09'); await bounded.press('Enter');
  await expect(page.getByRole('heading', { name: '2026-09 禁止未来时间验收', exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  const start = page.getByRole('combobox', { name: '报告期间开始', exact: true });
  const end = page.getByRole('textbox', { name: '报告期间结束', exact: true });
  await start.fill('2026-02'); await start.press('Enter');
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].filter.time).toMatchObject({ start: '2026-02', end: '2026-06' });
  await end.fill('2026-04'); await end.press('Enter');
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].filter.time).toMatchObject({ start: '2026-02', end: '2026-04' });
  await expect(page.locator('[data-component="header/report-header"] .as-of')).toHaveText('当前期间：2026-02 至 2026-04');
  await expect(page.getByRole('heading', { name: '2026-08 经营分析报告', exact: true })).toBeVisible();
  await expect(bounded).toHaveValue('2026-09');
});
