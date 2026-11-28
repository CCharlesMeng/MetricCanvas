import { expect, test, type Page } from '@playwright/test';

const endpoint = '/synthetic-business-finalization';
const nameField = '合成报表名';
const dateField = '合成定稿日';
const monthlyMetric = '净商务折扣（原价）月变化';
const periodHeadings = {
  month: '净商务折扣（原价）月环比变化',
  quarter: '净商务折扣（原价）季同比变化',
  year: '净商务折扣（原价）年同比变化'
};
const pageUrl = '/pages/business-result-metrics?region=';

type Query = { output_dims: string[]; output_metrics: string[]; filter: { time?: { period: string; start?: string } } };

function gate(blocked: boolean) {
  let release = () => {};
  const ready = blocked ? new Promise<void>(resolve => { release = resolve; }) : Promise.resolve();
  return { ready, release: () => release() };
}

function receipt(query: Query) {
  const region = query.output_dims.includes('地区部');
  const office = query.output_dims.includes('代表处');
  const names = region || office ? ['A', 'B', 'C'] : ['A'];
  if (office && query.output_metrics.includes(monthlyMetric)) names.push('D');
  const data = names.map(name => Object.fromEntries([
    ...query.output_dims.map(dim => [dim, dimensionValue(dim, name)]),
    ...query.output_metrics.map(metric => [metric, metric === monthlyMetric ? 2.37 : 42])
  ]));
  if (office && query.output_dims.includes('决策业务类型')) {
    data.push(...data.map(row => ({ ...row, 决策业务类型: '合同' })));
  }
  return { code: 'SUCCESS', data, total_count: data.length };
}

function dimensionValue(field: string, suffix: string) {
  if (field === '地区部' || field === '代表处') return '合成' + field + suffix;
  if (field === '决策业务类型') return '商务';
  return '合成候选';
}

async function installDqe(page: Page, options: { holdDate?: boolean; holdMonth?: boolean; workspace?: string } = {}) {
  const date = gate(!!options.holdDate);
  const month = gate(!!options.holdMonth);
  const business: Query[] = [];
  let dates = 0;
  await page.addInitScript(config => Object.assign(window, { __METRICCANVAS__: config }), {
    dqeEndpoint: endpoint, pageMetadataBaseUrl: '/pages', authToken: 'synthetic', operatorId: 'synthetic',
    workspaceId: options.workspace ?? 'synthetic',
    finalizationSource: { nameField, dateField, body: { dsl_list: [{ output_dims: [nameField, dateField], output_metrics: [], filter: { dims: [], metrics: [] } }] } }
  });
  await page.route('**' + endpoint, async route => {
    const queries: Query[] = route.request().postDataJSON().dsl_list;
    const results = await Promise.all(queries.map(async query => {
      if (query.output_dims.includes(nameField)) {
        dates++;
        await date.ready;
        return { code: 'SUCCESS', total_count: 1, data: [{ [nameField]: '业务结果指标', [dateField]: '2026-10-15' }] };
      }
      if (query.filter?.time) business.push(query);
      if (query.output_metrics?.includes(monthlyMetric)) await month.ready;
      return receipt(query);
    }));
    await route.fulfill({ json: { retCode: 'CBC.0000', results } });
  });
  return { date, month, business, dates: () => dates };
}

function heading(page: Page, mode: keyof typeof periodHeadings) {
  return page.locator('.table-widget thead th').filter({ hasText: periodHeadings[mode] });
}

test('shows the selected month heading while finalization waits and fills slow discount cells in place', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || /DQE_QUERY_REJECTED|TABLE_PINNED_RESULT_INVALID/.test(message.text())) errors.push(message.text());
  });
  const dqe = await installDqe(page, { holdDate: true, holdMonth: true });
  await page.goto(pageUrl);
  await expect.poll(dqe.dates, { timeout: 15000 }).toBe(1);
  await expect(heading(page, 'month')).toHaveCount(2);
  expect(dqe.business).toHaveLength(0);

  dqe.date.release();
  const tables = page.locator('.table-widget');
  await expect(tables.nth(0).locator('tbody')).toContainText('合成地区部A');
  await expect(tables.nth(1).locator('tbody')).toContainText('合成代表处A');
  await expect.poll(() => dqe.business.filter(query => query.output_metrics?.includes(monthlyMetric)).length).toBeGreaterThan(0);
  const cells = await tables.evaluateAll(widgets => widgets.map(widget => {
    const row = widget.querySelector('tbody tr:not([data-pinned-top])')!;
    const index = Array.from(widget.querySelectorAll('thead th')).findIndex(cell => cell.textContent.includes('月环比变化'));
    const cell = row.children[index]!;
    row.setAttribute('data-repro-row', '');
    cell.setAttribute('data-repro-cell', '');
    return !!cell.querySelector('.skeleton');
  }));
  expect(cells).toEqual([true, true]);
  const offices = tables.nth(1).locator('tbody tr').filter({ hasText: '合成代表处' });
  await expect(offices).toHaveCount(3);
  dqe.month.release();
  await expect(tables.nth(0).locator('tbody')).toContainText('+2.37');
  await expect(tables.nth(1).locator('tbody')).toContainText('+2.4');
  await expect(tables.locator('tr[data-repro-row] td[data-repro-cell]')).toHaveCount(2);
  await expect(offices).toHaveCount(4);
  await expect(offices.last()).toContainText('合成代表处D');
  await expect(offices.last()).toContainText('—');
  expect(errors).toEqual([]);
});

test('switches year, quarter and back to month while finalization is pending', async ({ page }) => {
  const dqe = await installDqe(page, { holdDate: true });
  await page.goto(pageUrl);
  const period = page.locator('[data-filter-id="mtime"]');
  await expect(heading(page, 'month')).toHaveCount(2);
  for (const [label, mode] of [['季', 'quarter'], ['年', 'year']] as const) {
    await period.getByRole('button', { name: label, exact: true }).click();
    await expect(heading(page, mode)).toHaveCount(2);
    await expect(heading(page, 'month')).toHaveCount(0);
    await expect.poll(() => dqe.business.some(query => query.filter.time?.period === mode)).toBe(true);
  }
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(heading(page, 'month')).toHaveCount(2);
  await expect(heading(page, 'year')).toHaveCount(0);
  expect(dqe.business.some(query => query.filter.time?.period === 'month')).toBe(false);
  dqe.date.release();
  await expect.poll(() => dqe.business.some(query => query.filter.time?.period === 'month' && query.filter.time.start === '2026-10')).toBe(true);
  await expect(heading(page, 'month')).toHaveCount(2);
});

test('reuses finalization through a new browser page until the calendar day or identity changes', async ({ page, context }) => {
  const today = '2026-11-25T03:00:00Z';
  const first = await installDqe(page);
  await page.clock.setFixedTime(new Date(today));
  await page.goto(pageUrl);
  await expect.poll(() => first.business.length).toBeGreaterThan(0);
  expect(first.dates()).toBe(1);

  const next = await context.newPage();
  const subsequent = await installDqe(next);
  await next.clock.setFixedTime(new Date(today));
  await next.goto(pageUrl);
  await expect.poll(() => subsequent.business.length).toBeGreaterThan(0);
  expect(subsequent.dates()).toBe(0);

  const other = await context.newPage();
  const otherDqe = await installDqe(other, { workspace: 'other' });
  await other.clock.setFixedTime(new Date(today));
  await other.goto(pageUrl);
  await expect.poll(() => otherDqe.business.length).toBeGreaterThan(0);
  expect(otherDqe.dates()).toBe(1);

  await next.clock.setFixedTime(new Date('2026-11-26T00:00:00Z'));
  await next.reload();
  await expect.poll(subsequent.dates).toBe(1);
});

test('a late month reply cannot append an office after switching to quarter', async ({ page }) => {
  const dqe = await installDqe(page, { holdMonth: true });
  await page.goto(pageUrl + '&mtime=month:2026-10');
  const table = page.locator('.table-widget').nth(1);
  await expect.poll(() => dqe.business.some(query => query.output_metrics.includes(monthlyMetric))).toBe(true);
  await expect(table.locator('tbody')).toContainText('合成代表处A');
  await page.locator('[data-filter-id="mtime"]').getByRole('button', { name: '季', exact: true }).click();
  await expect(table.locator('thead')).toContainText(periodHeadings.quarter);
  await expect(table.locator('tbody')).toContainText('合成代表处C');
  dqe.month.release();
  await expect(table.locator('tbody')).toContainText('+42');
  await expect(table.locator('tbody')).not.toContainText('合成代表处D');
});
