import {expect,test} from '@playwright/test';
const source='/pages/ioc-auto-back-source',detail='/pages/ioc-auto-back-detail';
const back='[data-ioc-header] [data-dashboard-back]';
async function drill(page:import('@playwright/test').Page){
 await page.goto(source+'?region=north');
 await page.getByRole('link',{name:/^下钻项目 1/}).click();
 await expect(page).toHaveURL(new RegExp(detail));await expect(page.locator(back)).toBeVisible();
}
test('same-detail URL edits, filters and refresh retain the actual source URL',async({page})=>{
 await drill(page);await page.reload();await expect(page.locator(back)).toBeVisible();
 await page.goto(detail+'?project=2');await expect(page.locator(back)).toBeVisible();
 await expect(page.locator('[data-component="main/project"]')).toContainText('2');
 await page.getByRole('checkbox',{name:'仅有效'}).check();await expect(page).toHaveURL(/active=true/);
 await page.reload();await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL(new RegExp(source+'\\?region=north$'));
});
test('direct entry and same-origin or external interruptions cannot revive an old source',async({page})=>{
 await page.goto(detail+'?project=1');await expect(page.getByRole('heading',{name:'下钻自动返回：项目详情'})).toBeVisible();
 await expect(page.locator(back)).toHaveCount(0);
 await drill(page);await page.goto('/pages/ioc-auto-back-unrelated');await page.goto(detail+'?project=2');await expect(page.locator(back)).toHaveCount(0);
 await drill(page);await page.goto('http://localhost:5183/pages/ioc-auto-back-unrelated');await page.goto('http://127.0.0.1:5183'+detail+'?project=3');await expect(page.locator(back)).toHaveCount(0);
});
test('new tabs do not inherit provenance, including opener-created tabs',async({page,context})=>{
 await drill(page);
 const tab=await context.newPage();await tab.goto(detail+'?project=2');await expect(tab.locator(back)).toHaveCount(0);
 const popupPromise=page.waitForEvent('popup');await page.evaluate(href=>window.open(href,'_blank'),detail+'?project=2');
 const popup=await popupPromise;await expect(popup.getByRole('heading',{name:'下钻自动返回：项目详情'})).toBeVisible();await expect(popup.locator(back)).toHaveCount(0);
});
test('nested details return through the immediate source and browser traversal restores entry provenance',async({page})=>{
 await drill(page);await page.goBack();await page.goForward();await expect(page.locator(back)).toBeVisible();
 await page.getByRole('link',{name:/^继续下钻/}).click();await expect(page).toHaveURL(/ioc-auto-back-subdetail/);await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL(new RegExp(detail));await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL(new RegExp(source+'\\?region=north$'));
});
test('legacy explicit browser return remains available',async({page})=>{
 await page.goto('/pages/ioc-default-back-source');await page.getByRole('link',{name:/^打开默认返回页/}).click();
 await expect(page.locator(back)).toBeVisible();await page.locator(back).click();await expect(page).toHaveURL(/ioc-default-back-source/);
});
test('dedicated IOC showcase keeps its explicit legacy return control',async({page})=>{
 await page.goto('/pages/ioc-header-demo?back=1');await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL('http://127.0.0.1:5183/');
});
