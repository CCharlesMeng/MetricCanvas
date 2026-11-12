import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T12:00:00+08:00') });
});

test('IOC Header remembers the quarter independently of the month', async ({ page }) => {
  await page.goto('/pages/ioc-header-flow-sticky');
  const period = page.locator('[data-period-filter]');
  const input = period.getByRole('combobox');
  await period.getByRole('button', { name: '季', exact: true }).click();
  await input.fill('2025-Q3');
  await input.press('Enter');
  await expect(input).toHaveValue('2025 年 Q3');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await input.fill('2025-01');
  await input.press('Enter');
  await expect(input).toHaveValue('2025-01');
  await period.getByRole('button', { name: '年', exact: true }).click();
  await input.click();
  await page.getByRole('button', { name: '2024', exact: true }).click();
  await expect(input).toHaveValue('2024 年');
  await period.getByRole('button', { name: '季', exact: true }).click();
  await expect(input).toHaveValue('2024 年 Q3');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(input).toHaveValue('2024-01');
  await period.getByRole('button', { name: '季', exact: true }).click();
  await expect(input).toHaveValue('2024 年 Q3');
});

test('IOC Header remembers the month independently of the quarter', async ({ page }) => {
  await page.goto('/pages/ioc-header-flow-sticky');
  const period = page.locator('[data-period-filter]');
  const input = period.getByRole('combobox');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await input.fill('2025-08');
  await input.press('Enter');
  await expect(input).toHaveValue('2025-08');
  await period.getByRole('button', { name: '季', exact: true }).click();
  await input.fill('2025-Q1');
  await input.press('Enter');
  await expect(input).toHaveValue('2025 年 Q1');
  await period.getByRole('button', { name: '年', exact: true }).click();
  await input.click();
  await page.getByRole('button', { name: '2024', exact: true }).click();
  await expect(input).toHaveValue('2024 年');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(input).toHaveValue('2024-08');
  await period.getByRole('button', { name: '季', exact: true }).click();
  await expect(input).toHaveValue('2024 年 Q1');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(input).toHaveValue('2024-08');
});


test('first visits still derive a period from the applied year', async ({ page }) => {
  await page.goto('/pages/ioc-header-flow-sticky');
  const period = page.locator('[data-period-filter]');
  await period.getByRole('button', { name: '季', exact: true }).click();
  await expect(period.getByRole('combobox')).toHaveValue('2026 年 Q1');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(period.getByRole('combobox')).toHaveValue('2026-01');
});

test('rolling periods preserve both memories for date precision', async ({ page }) => {
  await page.goto('/pages/ioc-header-time');
  const period = page.locator('[data-period-filter]');
  const input = period.getByRole('combobox');
  await expect(input).toHaveValue('2026-09');
  await period.getByRole('button', { name: '季', exact: true }).click();
  await input.fill('2025-Q1');
  await input.press('Enter');
  await expect(input).toHaveValue('2025 年 Q1');
  await period.getByRole('button', { name: '近一年', exact: true }).click();
  await expect(period.locator('[data-period-range]')).toHaveText('25年11月~26年10月');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(input).toHaveValue('2025-09');
  await period.getByRole('button', { name: '季', exact: true }).click();
  await expect(input).toHaveValue('2025 年 Q1');
});

test('a rejected future month leaves the applied year and remembered month intact', async ({ page }) => {
  await page.goto('/pages/ioc-header-flow-sticky');
  const period = page.locator('[data-period-filter]');
  const input = period.getByRole('combobox');
  await period.getByRole('button', { name: '年', exact: true }).click();
  await input.fill('2025');
  await input.press('Enter');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await input.fill('2025-12');
  await input.press('Enter');
  await expect(input).toHaveValue('2025-12');
  await period.getByRole('button', { name: '年', exact: true }).click();
  await input.fill('2026');
  await input.press('Enter');
  await expect(input).toHaveValue('2026 年');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(input).toHaveValue('2026 年');
  await expect(period.getByRole('button', { name: '年', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(period.getByRole('button', { name: '月', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await input.fill('2025');
  await input.press('Enter');
  await period.getByRole('button', { name: '月', exact: true }).click();
  await expect(input).toHaveValue('2025-12');
});
