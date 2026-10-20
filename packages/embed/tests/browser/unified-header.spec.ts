import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
test.use({timezoneId:'Asia/Shanghai'});
test('canonical readonly header disables every primary and overflow filter',async({page})=>{
 await page.clock.install({time:new Date('2026-10-20T12:00:00+08:00')});
 const fixture=readFileSync(new URL('../../../page/fixtures/contract-valid/unified-overflow-header.json',import.meta.url),'utf8');
 await page.route('**/pages/unified-overflow-header.json',route=>route.fulfill({contentType:'application/json',body:fixture}));
 await page.goto('/pages/unified-overflow-header');
 const header=page.locator('header[data-ioc-header]');await expect(header).toHaveCount(1);await expect(header).toContainText('只读验收：包括更多筛选');
 await header.locator('[data-dashboard-filter-overflow]>summary').click();
 await expect(header.locator('[data-filter-control]')).toHaveCount(10);
 expect(await header.locator('[data-filter-control] :is(input,button)').evaluateAll(nodes=>nodes.length>0&&nodes.every(node=>(node instanceof HTMLInputElement||node instanceof HTMLButtonElement)&&node.disabled))).toBe(true);
});
