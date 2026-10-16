import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Asia/Shanghai' });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T12:00:00+08:00') });
});

test('months, years, typing, keyboard, URL and month rollover respect the current month', async ({ page }, info) => {
  await page.goto('/pages/time-point-no-future');
  const input = page.getByRole('combobox', { name: '报告月份', exact: true });
  await expect(input).toHaveValue('2026-10');
  await input.click();
  const picker = page.getByRole('dialog', { name: '报告月份', exact: true });
  await expect(picker.getByRole('button', { name: '2026-10', exact: true })).toBeEnabled();
  for (const name of ['2026-11', '2026-12', '后一年']) await expect(picker.getByRole('button', { name, exact: true })).toBeDisabled();
  const october = picker.getByRole('button', { name: '2026-10', exact: true });
  await october.focus(); await october.press('ArrowRight'); await expect(october).toBeFocused();
  await october.press('PageDown'); await expect(october).toBeFocused();
  await picker.getByRole('button', { name: '2026 年', exact: true }).click();
  await expect(picker.getByRole('button', { name: '2027', exact: true })).toBeDisabled();
  await picker.getByRole('button', { name: '2026', exact: true }).click();
  await page.screenshot({ path: info.outputPath('future-months-disabled.png'), fullPage: true });
  await input.press('Escape');
  await input.fill('2026-11'); await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得晚于 2026-10');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026-10 禁止未来时间验收');
  await page.goto('/pages/time-point-no-future?report-month=2027-01');
  await expect(input).toHaveValue('2026-10');
  await page.clock.setSystemTime(new Date('2026-11-01T12:00:00+08:00'));
  await input.click();
  await expect(picker.getByRole('button', { name: '2026-11', exact: true })).toBeEnabled();
  await picker.getByRole('button', { name: '2026-11', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026-11 禁止未来时间验收');
});

test('day selection and typing include today and reject tomorrow', async ({ page }) => {
  await page.goto('/pages/time-point-no-future');
  const input = page.getByRole('combobox', { name: '报告日期', exact: true });
  await input.fill('2026-10-15'); await input.press('Enter'); await input.click();
  const picker = page.getByRole('dialog', { name: '报告日期', exact: true });
  await expect(picker.getByRole('button', { name: '2026-10-15', exact: true })).toBeEnabled();
  await expect(picker.getByRole('button', { name: '2026-10-16', exact: true })).toBeDisabled();
  await expect(picker.getByRole('button', { name: '下个月', exact: true })).toBeDisabled();
  await input.press('Escape'); await input.fill('2026-10-16'); await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得晚于 2026-10-15');
  await expect(page.locator('.as-of')).toHaveText('报告日期 2026-10-15');
});

test('the exact ultimate SDT file defaults to October and future input cannot trigger queries', async ({ page }) => {
  const fixture = readFileSync(new URL('../../../../pages/sdt/commercial-sdt-efficiency-ultimate-monthly.json', import.meta.url), 'utf8');
  await page.route('**/pages/commercial-sdt-efficiency-ultimate-monthly.json', route => route.fulfill({ contentType: 'application/json', body: fixture }));
  const requests: any[] = [];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items = route.request().postDataJSON().dsl_list; requests.push(...items);
    await route.fulfill({ json: { retCode: 'CBC.0000', results: items.map(() => ({ code: 'SUCCESS', data: [], total_count: 0 })) } });
  });
  await page.goto('/pages/commercial-sdt-efficiency-ultimate-monthly');
  const input = page.getByRole('combobox', { name: '报告期间', exact: true });
  await expect(input).toHaveValue('2026-10');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('商务SDT行权效率专项报告');
  await expect.poll(() => requests.length).toBe(14);
  expect(requests.every(q => q.filter.time.end.replaceAll('-', '') === '202610')).toBe(true);
  await input.fill('2026-11'); await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得晚于 2026-10');
  expect(requests).toHaveLength(14);
  await input.fill('2026-09'); await input.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('商务SDT行权效率专项报告');
  await expect.poll(() => requests.length).toBe(28);
  expect(requests.slice(14).filter(q => q.filter.time.start.replaceAll('-', '') === '202604')).toHaveLength(3);
});
