import {expect,test} from '@playwright/test';
const source='/pages/ioc-auto-back-source',detail='/pages/ioc-auto-back-detail';
const back='[data-ioc-header] [data-dashboard-back]';

test('IOC return follows browser entries after drill, refresh and nested drill',async({page})=>{
 await page.goto(source+'?region=north');
 await page.getByRole('link',{name:/^下钻项目 1/}).click();
 await expect(page).toHaveURL(new RegExp(detail));await expect(page.locator(back)).toBeVisible();
 await page.reload();await expect(page.locator(back)).toBeVisible();
 await page.getByRole('checkbox',{name:'仅有效'}).check();await expect(page).toHaveURL(/active=true/);
 await page.getByRole('link',{name:/^继续下钻/}).click();await expect(page).toHaveURL(/ioc-auto-back-subdetail/);
 await page.locator(back).click();await expect(page).toHaveURL(new RegExp(detail));await expect(page).toHaveURL(/active=true/);
 await page.locator(back).click();await expect(page).toHaveURL(new RegExp(source+'\\?region=north$'));
});
test('an unrelated previous page is sufficient; query edits return one native entry',async({page})=>{
 await page.goto('/pages/ioc-auto-back-unrelated');await page.goto(detail+'?project=1');
 await expect(page.locator(back)).toBeVisible();
 await page.goto(detail+'?project=2');await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL(new RegExp(detail+'\\?project=1$'));
 await page.locator(back).click();await expect(page).toHaveURL(/ioc-auto-back-unrelated/);
});
test('a fresh tab hides unavailable return and false hides even with history',async({page,context})=>{
 const tab=await context.newPage();await tab.goto(detail+'?project=2');
 await expect(tab.locator('[data-ioc-title]')).toBeVisible();await expect(tab.locator(back)).toHaveCount(0);
 await page.goto(source);await page.goto('/pages/ioc-back-hidden');
 await expect(page.locator('[data-ioc-title]')).toHaveText('显式隐藏返回');await expect(page.locator(back)).toHaveCount(0);
});
test('legacy explicit browser return remains available',async({page})=>{
 await page.goto('/pages/ioc-default-back-source');await page.getByRole('link',{name:/^打开默认返回页/}).click();
 await expect(page.locator(back)).toBeVisible();await page.locator(back).click();await expect(page).toHaveURL(/ioc-default-back-source/);
});
test('dedicated IOC showcase keeps its explicit custom return',async({page})=>{
 await page.goto('/pages/ioc-header-demo?back=1');await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL(new URL('/',page.url()).href);
});
