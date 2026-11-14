import {expect,test} from '@playwright/test';

test('Svelte page invalidates once, stays stopped across update, and reenters without cached rows',async({page})=>{
  await page.goto('/auth-required-review');
  await expect(page.getByRole('cell',{name:'合成请求1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'发送 419',exact:true}).click();
  await expect(page.locator('[data-auth-count]')).toHaveText('处理次数：1');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button',{name:'发送 401',exact:true}).click();
  await expect(page.locator('[data-send-count]')).toHaveText('请求次数：2');
  await page.getByRole('button',{name:'模拟登录后重新进入'}).click();
  await expect(page.getByRole('cell',{name:'合成请求3',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'合成请求1',exact:true})).toHaveCount(0);
});

test('Svelte optional handler and other errors retain existing page behavior',async({page})=>{
  await page.goto('/auth-required-review');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('checkbox',{name:'传入 onAuthRequired'}).uncheck();
  await page.getByRole('button',{name:'发送 403',exact:true}).click();
  await expect(page.locator('[data-auth-events]')).toContainText('403');
  await expect(page.locator('[data-auth-count]')).toHaveText('处理次数：0');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('checkbox',{name:'传入 onAuthRequired'}).check();
  await page.getByRole('button',{name:'发送 500',exact:true}).click();
  await expect(page.locator('[data-send-count]')).toHaveText('请求次数：3');
  await expect(page.locator('[data-auth-count]')).toHaveText('处理次数：0');
  await page.getByRole('button',{name:'发送 401',exact:true}).click();
  await expect(page.locator('[data-auth-count]')).toHaveText('处理次数：1');
  await expect(page.getByRole('table')).toHaveCount(0);
});
