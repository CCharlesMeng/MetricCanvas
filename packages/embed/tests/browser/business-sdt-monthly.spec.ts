import { expect, test, type Page } from '@playwright/test';
test.beforeEach(async ({page}) => { await page.clock.install({time:new Date('2026-10-15T12:00:00+08:00')}); });

// Synthetic transport data proves binding and rendering only, never real SDT facts.
async function syntheticDqe(page: Page) {
  const requests: any[] = [];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items = route.request().postDataJSON().dsl_list;
    requests.push(...items);
    const results = items.map((item: any) => {
      const month = Number(item.filter.time.end.replace(/-/g, '').slice(-2));
      const data = item.filter.time.end.replace(/-/g, '') === '202608' ? [] : [Object.fromEntries([
        ...item.output_dims.map((field: string) => [field, field === '账期(month)' ? item.filter.time.end : `合成验收-${field}`]),
        ...item.output_metrics.map((field: string) => [field, month])
      ])];
      return { code: 'SUCCESS', data, total_count: data.length };
    });
    await route.fulfill({ json: { retCode: 'CBC.0000', results } });
  });
  return requests;
}

const monthControl = (page: Page) => page.getByRole('combobox', { name: '报告月份', exact: true });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const compact = (value: string) => value.replace(/-/g, '');

test('new SDT page binds all visible queries, main title and statistical month', async ({ page }, info) => {
  const requests = await syntheticDqe(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/pages/business-sdt-report-monthly');
  await expect(heading(page)).toHaveText('2026-10 商务SDT行权效率专项报告');
  await expect(page.locator('.as-of')).toHaveText('统计月份：2026-10');
  await expect.poll(() => requests.length).toBe(14);
  const month = monthControl(page);
  await month.fill('2026-09');
  await expect(heading(page)).toHaveText('2026-10 商务SDT行权效率专项报告');
  expect(requests).toHaveLength(14);
  await month.press('Enter');
  await expect(heading(page)).toHaveText('2026-09 商务SDT行权效率专项报告');
  await expect(page.locator('.as-of')).toHaveText('统计月份：2026-09');
  await expect.poll(() => requests.length).toBe(28);
  const september = requests.slice(14);
  expect(september.filter(item => compact(item.filter.time.start) === '202604')).toHaveLength(3);
  expect(september.filter(item => compact(item.filter.time.start) === '202609')).toHaveLength(11);
  expect(september.every(item => compact(item.filter.time.end) === '202609')).toBe(true);
  await expect(page.getByText('2026年10月固定摘要（不随月份筛选更新）', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '清除时间点', exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('september.png'), fullPage: true });

  await month.fill('2020-06'); await month.press('Enter');
  await expect.poll(() => requests.length).toBe(42);
  expect(requests.slice(28).filter(item => compact(item.filter.time.start) === '202001')).toHaveLength(3);
  await expect(heading(page)).toHaveText('2020-06 商务SDT行权效率专项报告');
  await month.click();
  const picker = page.getByRole('dialog', { name: '报告月份', exact: true });
  for (const value of ['2020-01', '2020-05']) await expect(picker.getByRole('button', { name: value, exact: true })).toBeDisabled();
  await expect(picker.getByRole('button', { name: '2020-06', exact: true })).toBeEnabled();
  await expect(picker.getByRole('button', { name: '前一年', exact: true })).toBeDisabled();
  await picker.getByRole('button', { name: '2020-06', exact: true }).focus();
  await picker.getByRole('button', { name: '2020-06', exact: true }).press('ArrowLeft');
  await expect(picker.getByRole('button', { name: '2020-06', exact: true })).toBeFocused();
  await month.press('Escape');
  for (const invalid of ['2020-05', '2019-12', '2020-13', '']) {
    await month.fill(invalid); await month.press('Enter');
    // Empty Enter opens the picker, while native required input cannot clear applied state.
    await expect(heading(page)).toHaveText('2020-06 商务SDT行权效率专项报告');
    expect(requests).toHaveLength(42);
  }
  await month.fill('2020-05'); await month.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得早于 2020-06');
  await month.fill('2026-11'); await month.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得晚于 2026-10');
  expect(requests).toHaveLength(42);
  await month.fill('2026-08'); await month.press('Enter');
  await expect.poll(() => requests.length).toBe(56);
  await expect(heading(page)).toHaveText('2026-08 商务SDT行权效率专项报告');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('URL month lower bound, picker year disabling and narrow layout', async ({ page }, info) => {
  const requests = await syntheticDqe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pages/business-sdt-report-monthly?report-month=2020-06');
  await expect(heading(page)).toHaveText('2020-06 商务SDT行权效率专项报告');
  await expect.poll(() => requests.length).toBe(14);
  await monthControl(page).click();
  const picker = page.getByRole('dialog', { name: '报告月份', exact: true });
  await picker.getByRole('button', { name: '2020 年', exact: true }).click();
  await expect(picker.getByRole('button', { name: '前一年', exact: true })).toBeDisabled();
  await expect(picker.getByRole('button', { name: '2020', exact: true })).toBeEnabled();
  await picker.getByRole('button', { name: '2020', exact: true }).click();
  await expect(picker.getByRole('button', { name: '2020-05', exact: true })).toBeDisabled();
  await expect(picker.getByRole('button', { name: '2020-05', exact: true })).toHaveCSS('color', 'rgb(194, 194, 194)');
  await page.screenshot({ path: info.outputPath('minimum-month-mobile.png') });
  await page.goto('/pages/business-sdt-report-monthly?report-month=2020-05');
  await expect(heading(page)).toHaveText('2026-10 商务SDT行权效率专项报告');
  await expect(monthControl(page)).toHaveValue('2026-10');
  await expect(page.locator('.as-of')).toHaveText('统计月份：2026-10');
});

test('shared date picker respects day minima as well as month minima', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const fixture = readFileSync(new URL('../../../page/fixtures/contract-valid/time-point-min-page.json', import.meta.url), 'utf8');
  await page.route('**/pages/time-point-min-page.json', route => route.fulfill({ contentType: 'application/json', body: fixture }));
  await page.goto('/pages/time-point-min-page');
  const date = page.getByRole('combobox', { name: '报告日期', exact: true });
  await expect(date).toHaveValue('2020-06-15');
  await date.fill('2020-06-14'); await date.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得早于 2020-06-15');
  await date.press('Escape'); await date.click();
  const picker = page.getByRole('dialog', { name: '报告日期', exact: true });
  await expect(picker.getByRole('button', { name: '2020-06-14', exact: true })).toBeDisabled();
  await expect(picker.getByRole('button', { name: '上个月', exact: true })).toBeDisabled();
  await picker.getByRole('button', { name: '2020-06-16', exact: true }).click();
  await expect(date).toHaveValue('2020-06-16');
});
