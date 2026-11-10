import {expect,test} from '@playwright/test';

test('old auto is a true alias without source context, including custom overrides and false',async({page})=>{
 await page.goto('/pages/ioc-auto-back-unrelated');
 await page.goto('/pages/ioc-auto-back-detail?project=1');
 const back=page.locator('[data-dashboard-back]');
 await expect(back).toBeVisible();
 await page.evaluate(()=>{
  window.pageDocument.sections[0].components[0].props.back='auto';
  window.runtime.update({document:window.pageDocument});
 });
 await expect(back).toBeVisible();
 await page.evaluate(()=>window.runtime.update({document:window.pageDocument,navigation:{back(){document.body.dataset.autoBack='override';}}}));
 await back.click();await expect(page.locator('body')).toHaveAttribute('data-auto-back','override');
 // The deprecated source action must not override native history.
 await page.evaluate(()=>window.runtime.update({document:window.pageDocument,navigation:{returnContext:{entryId:'old-source',back(){document.body.dataset.autoBack='source-action';}}}}));
 await back.click();await expect(page).toHaveURL(/ioc-auto-back-unrelated/);
 await page.goto('/pages/ioc-back-hidden');await expect(back).toHaveCount(0);
 await page.evaluate(()=>window.runtime.update({document:window.pageDocument,navigation:{back(){document.body.dataset.autoBack='hidden';}}}));
 await expect(back).toHaveCount(0);
});
test('old auto falls back to history.length without Navigation API',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'navigation',{value:undefined,configurable:true}));
 await page.goto('/pages/ioc-auto-back-unrelated');await page.goto('/pages/ioc-auto-back-detail?project=1');
 await page.evaluate(()=>{
  window.pageDocument.sections[0].components[0].props.back='auto';
  window.runtime.update({document:window.pageDocument});
 });
 const back=page.locator('[data-dashboard-back]');await expect(back).toBeVisible();
 await back.click();await expect(page).toHaveURL(/ioc-auto-back-unrelated/);
});
