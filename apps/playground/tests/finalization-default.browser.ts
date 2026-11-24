import {expect, test} from '@playwright/test';

test.beforeEach(async ({page}) => { await page.clock.install({time: new Date('2026-11-09T12:00:00+08:00')}); });

test('schema default, user edits, rolling period and drill-through share the applied time', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/pages/finalization-default-time');
  const period = page.locator('[data-period-filter]');
  await expect(period.getByRole('combobox')).toHaveValue('2026-10');
  await expect(page.getByText('2026-10 至 2026-10；定稿查询 1 次', {exact: true})).toBeVisible();
  await period.getByRole('combobox').fill('2026-08'); await period.getByRole('combobox').press('Enter');
  await expect(page.getByText('2026-08 至 2026-08；定稿查询 1 次', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '近一年', exact: true}).click();
  await expect(period.locator('[data-period-range]')).toHaveText('25年11月~26年10月');
  await expect(page.getByText('2025-11 至 2026-10；定稿查询 1 次', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '查看同期间下钻页'}).click();
  await expect(page).toHaveURL(/finalization-default-time-detail/);
  await expect(page.locator('[data-period-range]')).toHaveText('25年11月~26年10月');
  await expect(page.getByText('2025-11 至 2026-10；定稿查询 1 次', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});

for (const state of ['error', 'missing', 'invalid', 'conflict', 'timeout']) test(`falls back to current month for ${state}`, async ({page}) => {
  await page.goto(`/pages/finalization-default-time?state=${state}`);
  if (state === 'timeout') {
    await expect(page.locator('[data-filter-pending]')).toBeVisible();
    await page.clock.fastForward(180_001);
  }
  await expect(page.locator('[data-period-filter]').getByRole('combobox')).toHaveValue('2026-11');
  await expect(page.getByText('2026-11 至 2026-11；定稿查询 1 次', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '近一年', exact: true}).click();
  await expect(page.getByText('2025-12 至 2026-11；定稿查询 1 次', {exact: true})).toBeVisible();
});

test('shows post-finalization months greyed out as soon as the panel opens', async ({page}) => {
  await page.goto('/pages/finalization-default-time');
  const period=page.locator('[data-period-filter]');
  const month=period.getByRole('combobox');
  await expect(month).toHaveValue('2026-10');
  await month.click();
  await expect(page.getByRole('button',{name:'2026-10',exact:true})).toBeEnabled();
  const afterFinalization = page.getByRole('button',{name:'2026-11',exact:true});
  await expect(afterFinalization).toBeDisabled();
  await expect(afterFinalization).toHaveCSS('color', 'rgb(194, 194, 194)');
  await expect(afterFinalization).toHaveCSS('box-shadow', 'none');
  await month.fill('2026-11');
  await month.press('Enter');
  await expect(period.getByRole('status')).toBeVisible();
  await expect(page.getByText('2026-10 至 2026-10；定稿查询 1 次',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'季',exact:true}).click();
  await expect(period.getByRole('combobox')).toHaveValue('2026 年 Q4');
  await page.goto('/pages/finalization-default-time?period-filter=month:2026-11');
  await expect(month).toHaveValue('2026-10');
});

test('defaults to and restores a rolling window ending in the finalized month', async ({page}) => {
  await page.goto('/pages/finalization-default-time-detail');
  await expect(page.getByText('2025-11 至 2026-10；定稿查询 1 次', {exact: true})).toBeVisible();
  await page.goto('/pages/finalization-default-time?period-filter=last12Months');
  await expect(page.getByText('2025-11 至 2026-10；定稿查询 1 次', {exact: true})).toBeVisible();
});

test('still executes the schema lookup when a navigation period is supplied', async ({page}) => {
  await page.goto('/pages/finalization-default-time-detail?period-filter=month%3A2026-08');
  await expect(page.locator('[data-period-filter]').getByRole('combobox')).toHaveValue('2026-08');
  await expect(page.getByText('2026-08 至 2026-08；定稿查询 1 次', {exact: true})).toBeVisible();
});
