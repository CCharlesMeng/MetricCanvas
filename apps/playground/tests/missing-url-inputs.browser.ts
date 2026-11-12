import { expect, test } from '@playwright/test';

test('missing inputs keep the page, filters, empty data and unrelated static content', async ({page}) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/dsl/execute')) requests.push(request.url()); });
  await page.goto('/pages/missing-url-inputs');
  await expect(page.getByRole('heading',{name:'URL 缺参空态',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'—：相关明细',exact:true})).toBeVisible();
  await expect(page.getByText('静态内容仍可见',{exact:true})).toBeVisible();
  await expect(page.getByText('暂无数据',{exact:true})).toBeVisible();
  await expect(page.getByText('不得复用的旧数据',{exact:true})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'季',exact:true}).check();
  await expect(page.locator('.error-page')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('the account page retains its three period columns while required inputs are absent', async ({page}) => {
  await page.goto('/pages/rep-business-result-account-detail');
  await expect(page.getByRole('heading',{name:'账号明细',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'净付费月环比',exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:'季',exact:true}).check();
  await expect(page.getByRole('button',{name:'净付费季环比',exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:'年',exact:true}).check();
  await expect(page.getByRole('button',{name:'净付费同比',exact:true})).toBeVisible();
  await expect(page.getByText('暂无数据',{exact:true})).toBeVisible();
  await expect(page.locator('.error-page')).toHaveCount(0);
});
