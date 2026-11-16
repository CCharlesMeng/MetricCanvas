import { expect, test, type Page } from '@playwright/test';
import { chooseTree, closeSelection } from '../../../packages/embed/tests/browser/selection-actions';

const overview = '/pages/ioc-office-drill-overview';
const detail = '/pages/ioc-office-drill-detail';
const previous = '/pages/ioc-header-controls';
const region = (page: Page) => page.locator('[data-filter-id="region"]');
const period = (page: Page) => page.locator('[data-filter-id="stat-period"]');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener('metriccanvas:synthetic-header-controls', event => {
      const received = JSON.parse(sessionStorage.getItem('office-drill-queries') ?? '[]');
      received.push((event as CustomEvent).detail);
      sessionStorage.setItem('office-drill-queries', JSON.stringify(received));
    });
  });
});

test('selecting an office drills with the applied period and returns to the prior department', async ({ page }) => {
  await page.goto(`${overview}?period=quarter%3A2026-Q2`);
  await chooseTree(region(page), '同码地区部');
  await closeSelection(region(page));
  await expect(page.locator('[data-component="main/results"]')).toContainText('SAME');
  await expect(page).toHaveURL(/ioc-office-drill-overview.*region-dept=SAME/);
  const before = await page.evaluate(() => sessionStorage.getItem('office-drill-queries'));

  await chooseTree(region(page), '同码代表处');
  await expect(page).toHaveURL(new RegExp(`${detail}\\?`));
  await expect(region(page)).toContainText('同码代表处');
  const query = new URL(page.url()).searchParams;
  expect(query.get('rep-office')).toBe('SAME');
  expect(query.get('period')).toBe('quarter:2026-Q2');
  expect(query.get('period-from')).toMatch(/^2026-04/);
  expect(query.get('period-to')).toMatch(/^2026-06/);
  expect(await page.evaluate(() => sessionStorage.getItem('office-drill-queries'))).toBe(before);

  await page.getByRole('button', { name: '返回上一页', exact: true }).click();
  await expect(page).toHaveURL(/ioc-office-drill-overview.*region-dept=SAME/);
  await expect(region(page)).toContainText('同码地区部');
  await expect(period(page).getByRole('combobox')).toHaveValue('2026 年 Q2');
  expect(new URL(page.url()).searchParams.get('period')).toBe('quarter:2026-Q2');
});

test('opening an office in the overview replaces history before running overview queries', async ({ page }) => {
  await page.goto(previous);
  await expect(region(page)).toContainText('全球');
  await page.evaluate(() => sessionStorage.removeItem('office-drill-queries'));
  await page.goto(`${overview}?rep-office=SAME&period=last12Months&period-from=2025-10&period-to=2026-09`);
  await expect(page).toHaveURL(new RegExp(`${detail}\\?`));
  const query = new URL(page.url()).searchParams;
  expect(query.get('period')).toBe('last12Months');
  expect(query.get('period-from')).toBe('2025-10');
  expect(query.get('period-to')).toBe('2026-09');
  await expect(region(page)).toContainText('同码代表处');
  expect(await page.evaluate(() => sessionStorage.getItem('office-drill-queries'))).toBeNull();

  await page.getByRole('button', { name: '返回上一页', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${previous}(?:\\?|$)`));
});

test('a fresh tab with a direct office entry has no overview to return to', async ({ page }) => {
  await page.goto(`${overview}?rep-office=SAME`);
  await expect(page).toHaveURL(new RegExp(`${detail}\\?`));
  await expect(region(page)).toContainText('同码代表处');
  await expect(page.locator('[data-dashboard-back]')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('office-drill-queries'))).toBeNull();
});

test('a value-only office link resolves the authorized level before drilling', async ({ page }) => {
  await page.goto(`${overview}?region=上海代表处&period=quarter%3A2026-Q2`);
  await expect(page).toHaveURL(new RegExp(`${detail}\\?`));
  await expect(region(page)).toContainText('上海代表处');
  expect(new URL(page.url()).searchParams.get('rep-office')).toBe('上海代表处');
  expect(new URL(page.url()).searchParams.get('period')).toBe('quarter:2026-Q2');
  expect(await page.evaluate(() => sessionStorage.getItem('office-drill-queries'))).toBeNull();
});
