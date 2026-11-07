import {expect,test} from '@playwright/test';

test('auto return requires source and callback together; removing either hides the button',async({page})=>{
 await page.goto('/pages/ioc-auto-back-detail?project=1');
 const back=page.locator('[data-dashboard-back]');
 await expect(page.getByRole('heading',{name:'下钻自动返回：项目详情'})).toBeVisible();await expect(back).toHaveCount(0);
 await page.evaluate(()=>window.runtime.update({document:window.pageDocument,navigation:{back(){document.body.dataset.autoBack='called';}}}));
 await expect(back).toHaveCount(0);
 await page.evaluate(()=>window.runtime.update({document:window.pageDocument,navigation:{returnContext:{entryId:'validated-source',label:'返回清单'},back(){document.body.dataset.autoBack='called';}}}));
 await expect(back).toHaveAttribute('aria-label','返回清单');await back.click();await expect(page.locator('body')).toHaveAttribute('data-auto-back','called');
 await page.evaluate(()=>window.runtime.update({document:window.pageDocument,navigation:{returnContext:{entryId:'validated-source',back(){document.body.dataset.autoBack='context-action';}}}}));
 await expect(back).toBeVisible();await back.click();await expect(page.locator('body')).toHaveAttribute('data-auto-back','context-action');
 await page.evaluate(()=>window.runtime.update({document:window.pageDocument,navigation:{returnContext:{entryId:'validated-source'}}}));await expect(back).toHaveCount(0);
 await page.evaluate(()=>window.runtime.update({document:window.pageDocument}));await expect(back).toHaveCount(0);
});
