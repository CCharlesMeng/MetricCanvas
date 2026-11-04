import {test,expect} from '@playwright/test';
test('global Region retains other filters and key-office precedence',async({page},info)=>{
 await page.goto('/pages/key-office-priority-demo?region.level=geo&region='+encodeURIComponent('全球')+'&mtime=2026-04&customer-category='+encodeURIComponent('战略'));
 const rows=page.locator('tbody tr:not(:has(.empty-row))');
 await expect(rows).toHaveCount(2);await expect(rows).toContainText(['上海代表处','广州代表处']);
 await expect(page.locator('[data-filter-id="region"]')).toContainText('全球');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出',exact:true}).click();expect((await pending).suggestedFilename()).toMatch(/\.xlsx$/);
 const checkbox=page.getByRole('checkbox',{name:'仅看重点国代'});await checkbox.check();await expect(rows).toHaveCount(1);await expect(rows).toContainText('上海代表处');
 await checkbox.uncheck();await expect(rows).toHaveCount(2);
 await page.screenshot({path:info.outputPath('global-region-playground.png')});
});
