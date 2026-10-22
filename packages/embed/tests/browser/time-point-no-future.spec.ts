import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Asia/Shanghai' });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T12:00:00+08:00') });
});

test('months, years, typing, keyboard, URL and month rollover respect the current month', async ({ page }, info) => {
  await page.goto('/pages/report-date-filter-example');
  const input = page.getByRole('combobox', { name: '受限月份', exact: true });
  await expect(input).toHaveValue('2026-10');
  await input.click();
  const picker = page.getByRole('dialog', { name: '受限月份', exact: true });
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
  await expect(page.locator('[data-component="bounded-time/bounded-header"]').getByRole('heading', { level: 1 })).toHaveText('2026-10 禁止未来时间验收');
  await page.goto('/pages/report-date-filter-example?bounded-month=2027-01');
  await expect(input).toHaveValue('2026-10');
  await page.clock.setSystemTime(new Date('2026-11-01T12:00:00+08:00'));
  await input.click();
  await expect(picker.getByRole('button', { name: '2026-11', exact: true })).toBeEnabled();
  await picker.getByRole('button', { name: '2026-11', exact: true }).click();
  await expect(page.locator('[data-component="bounded-time/bounded-header"]').getByRole('heading', { level: 1 })).toHaveText('2026-11 禁止未来时间验收');
});

test('day selection and typing include today and reject tomorrow', async ({ page }) => {
  await page.goto('/pages/report-date-filter-example');
  const input = page.getByRole('combobox', { name: '受限日期', exact: true });
  await input.fill('2026-10-15'); await input.press('Enter'); await input.click();
  const picker = page.getByRole('dialog', { name: '受限日期', exact: true });
  await expect(picker.getByRole('button', { name: '2026-10-15', exact: true })).toBeEnabled();
  await expect(picker.getByRole('button', { name: '2026-10-16', exact: true })).toBeDisabled();
  await expect(picker.getByRole('button', { name: '下个月', exact: true })).toBeDisabled();
  await input.press('Escape'); await input.fill('2026-10-16'); await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得晚于 2026-10-15');
  await expect(page.locator('[data-component="bounded-time/bounded-header"] .as-of')).toHaveText('受限日期 2026-10-15');
});

test('the exact ultimate SDT file defaults to October and future input cannot trigger queries', async ({ page }) => {
  const fixture = readFileSync(new URL('../../../../pages/business/report/sdt/commercial-sdt-efficiency-ultimate-monthly.json', import.meta.url), 'utf8');
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

test('all default point and range inputs reject future values, panels and URL overrides', async ({page})=>{
  const requests:any[]=[];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',async route=>{
    const items=route.request().postDataJSON().dsl_list;requests.push(...items);
    await route.fulfill({json:{retCode:'CBC.0000',results:items.map(()=>({code:'SUCCESS',data:[],total_count:0}))}});
  });
  await page.goto('/pages/report-date-filter-example?report-month=2027-02&report-range.from=2027-02&report-range.to=2027-07');
  const month=page.getByRole('combobox',{name:'报告月份',exact:true});
  await expect(month).toHaveValue('2026-09');
  await expect(page.getByRole('combobox',{name:'对照期间开始',exact:true})).toHaveValue('2026-01');
  await month.click();
  const picker=page.getByRole('dialog',{name:'报告月份',exact:true});
  await expect(picker.getByRole('button',{name:'2026-11',exact:true})).toBeDisabled();
  await month.press('Escape');await month.fill('2026-11');await month.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得晚于 2026-10');
  await month.fill('2026-10');await month.press('Enter');
  const rangeStart=page.getByRole('combobox',{name:'报告期间开始',exact:true});
  const rangeEnd=page.getByRole('textbox',{name:'报告期间结束',exact:true});
  await rangeStart.click();
  await expect(page.getByRole('dialog',{name:'报告期间',exact:true}).getByRole('button',{name:'2026-11',exact:true})).toBeDisabled();
  await rangeStart.press('Escape');await rangeEnd.fill('2027-07');await rangeEnd.press('Enter');
  await expect(page.getByRole('status')).toHaveText('日期不得晚于 2026-10');
  await expect.poll(()=>requests.length).toBe(1);
  const dateEnd=page.getByRole('textbox',{name:'日期范围结束',exact:true});
  await dateEnd.fill('2026-10-16');await dateEnd.press('Enter');
  await expect(page.getByRole('status').filter({hasText:'日期不得晚于 2026-10-15'})).toBeVisible();
  const datetimeEnd=page.getByLabel('精确时间范围结束',{exact:true});
  await expect(datetimeEnd).toHaveAttribute('max','2026-10-15T12:00');
  await datetimeEnd.fill('2026-10-15T12:01');await datetimeEnd.blur();
  await expect(page.getByRole('status').filter({hasText:'日期不得晚于 2026-10-15T12:00'})).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('table header date ranges also default to today and reject future typing',async({page})=>{
  await page.goto('/pages/ioc-opportunity-list');
  const column=page.getByRole('columnheader',{name:'机会点创建时间',exact:false});
  await column.locator('summary').click();
  const inputs=column.locator('input[type="date"]');
  await expect(inputs.first()).toHaveAttribute('max','2026-10-15');
  await expect(inputs.nth(1)).toHaveAttribute('max','2026-10-15');
  await inputs.first().fill('2026-10-16');await inputs.first().blur();
  await expect(column.getByRole('status')).toHaveText('日期不得晚于 2026-10-15');
});
