import {expect, test, type Page} from '@playwright/test';

declare global {
  interface Window {
    captureScopeRequest: (item: unknown) => void;
    captureScopeRuntime: (event: unknown) => void;
  }
}

const table = (page: Page) => page.locator('[data-component="results/office-table"]');
const group = (page: Page, id: string) => page.locator(`[data-filter-group="${id}-office"]`);

async function captureRequests(page: Page) {
  const requests: unknown[] = [];
  await page.exposeFunction('captureScopeRequest', (item: unknown) => requests.push(item));
  await page.addInitScript(() => {
    window.addEventListener('metriccanvas:dimension-operator', event => {
      window.captureScopeRequest((event as CustomEvent).detail);
    });
  });
  return requests;
}

test('two chart dropdowns combine inclusion and exclusion in one request', async ({page}) => {
  const requests = await captureRequests(page);
  await page.goto('/pages/chart-include-exclude');
  await expect(table(page)).toContainText('总条数： 2');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({filter: {fields: [
    {field_name: '代表处', value_list: ['天津', '广州'], operator: '='}
  ]}});
  const include = group(page, 'include');
  const exclude = group(page, 'exclude');
  await expect(include).toBeVisible();
  await expect(exclude).toBeVisible();

  await include.hover();
  await include.getByRole('button', {name: '清空包含范围', exact: true}).click();
  await expect(table(page)).toContainText('总条数： 2');
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toMatchObject({filter: {fields: [
    {field_name: '代表处', value_list: ['北京'], operator: '!='}
  ]}});

  await exclude.getByRole('button', {name: '打开排除范围：北京', exact: true}).click();
  await page.getByRole('option', {name: '天津', exact: true}).click();
  await page.keyboard.press('Escape');
  await expect(table(page)).toContainText('总条数： 1');
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2]).toMatchObject({filter: {fields: [
    {field_name: '代表处', value_list: ['北京', '天津'], operator: '!='}
  ]}});
  await expect(table(page).getByRole('cell', {name: '广州', exact: true})).toBeVisible();

  await exclude.hover();
  await exclude.getByRole('button', {name: '清空排除范围', exact: true}).click();
  await expect(table(page)).toContainText('总条数： 3');
  await expect.poll(() => requests.length).toBe(4);
  expect(requests[3]).toMatchObject({filter: {fields: []}});
});

test('fully excluded inclusion gives an empty chart without a request', async ({page}) => {
  const requests = await captureRequests(page);
  await page.goto('/pages/chart-include-exclude?include-office='+encodeURIComponent('北京'));
  await expect(table(page)).toContainText('暂无数据');
  await expect(group(page, 'include')).toBeVisible();
  await expect(group(page, 'exclude')).toBeVisible();
  expect(requests).toEqual([]);
  await group(page, 'exclude').hover();
  await group(page, 'exclude').getByRole('button', {name: '清空排除范围', exact: true}).click();
  await expect(table(page)).toContainText('总条数： 1');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({filter: {fields: [
    {field_name: '代表处', value_list: ['北京'], operator: '='}
  ]}});
});

test('narrow toolbar and synthetic empty/error states retain both dropdowns', async ({page}) => {
  const runtimeEvents: unknown[] = [];
  await page.exposeFunction('captureScopeRuntime', (event: unknown) => runtimeEvents.push(event));
  await page.addInitScript(() => {
    window.addEventListener('metriccanvas:dimension-operator-runtime', event => {
      window.captureScopeRuntime((event as CustomEvent).detail);
    });
  });
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/pages/chart-include-exclude');
  await expect(table(page)).toContainText('总条数： 2');
  await expect(group(page, 'include')).toBeInViewport();
  await expect(group(page, 'exclude')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path: '../../.scratch/chart-include-exclude/mobile.png', fullPage: true});
  await page.goto('/pages/chart-include-exclude?state=empty');
  await expect(table(page)).toContainText('暂无数据');
  await expect(group(page, 'exclude')).toBeVisible();
  await page.goto('/pages/chart-include-exclude?state=error');
  await expect(group(page, 'include')).toBeVisible();
  await expect(group(page, 'exclude')).toBeVisible();
  await expect.poll(() => runtimeEvents).toContainEqual(expect.objectContaining({type: 'data-error'}));
});
