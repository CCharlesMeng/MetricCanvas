import { expect, test } from '@playwright/test';

test('Playground cleans unknown inputs while retaining declared inputs and its own preview controls', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('url-cleanup-document-loads', String(Number(sessionStorage.getItem('url-cleanup-document-loads')) + 1));
  });
  await page.goto('/pages/url-input-cleanup?account=A%2BB&active=true&view=detail&state=ready&unused=x#main');
  await expect(page.getByText('A+B', { exact: true })).toBeVisible();
  await expect(page.getByText('true', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '明细', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/account=A%2BB&active=true&view=detail&state=ready#main$/);
  const length = await page.evaluate(() => history.length);
  await page.getByRole('tab', { name: '概况', exact: true }).click();
  await expect(page).toHaveURL(/tab.views=overview/);
  expect(new URL(page.url()).searchParams.has('unused')).toBe(false);
  expect(await page.evaluate(() => history.length)).toBe(length);
  expect(await page.evaluate(() => sessionStorage.getItem('url-cleanup-document-loads'))).toBe('1');
  await page.reload();
  await expect(page.getByRole('tab', { name: '概况', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('A+B', { exact: true })).toBeVisible();
});

test('invalid known inputs are still diagnosed and leave the original URL unchanged', async ({ page }) => {
  await page.goto('/pages/url-input-cleanup?account=A&active=invalid&unused=x');
  await expect(page.getByRole('heading', { name: '页面输入不完整或无效', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('unused')).toBe('x');
});
