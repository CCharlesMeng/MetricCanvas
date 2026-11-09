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
  await expect(period.locator('[data-period-range]')).toHaveText('25年9月~26年8月');
  await expect(page.getByText('2025-09 至 2026-08；定稿查询 1 次', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '查看同期间下钻页'}).click();
  await expect(page).toHaveURL(/finalization-default-time-detail/);
  await expect(page.locator('[data-period-range]')).toHaveText('25年9月~26年8月');
  await expect(page.getByText('2025-09 至 2026-08；定稿查询 1 次', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});

for (const state of ['error', 'missing', 'invalid', 'conflict', 'timeout']) test(`falls back to current month for ${state}`, async ({page}) => {
  await page.goto(`/pages/finalization-default-time?state=${state}`);
  await expect(page.locator('[data-period-filter]').getByRole('combobox')).toHaveValue('2026-11');
  await expect(page.getByText('2026-11 至 2026-11；定稿查询 1 次', {exact: true})).toBeVisible();
});

test('still executes the schema lookup when a navigation period is supplied', async ({page}) => {
  await page.goto('/pages/finalization-default-time-detail?period-filter=month%3A2026-08');
  await expect(page.locator('[data-period-filter]').getByRole('combobox')).toHaveValue('2026-08');
  await expect(page.getByText('2026-08 至 2026-08；定稿查询 1 次', {exact: true})).toBeVisible();
});
