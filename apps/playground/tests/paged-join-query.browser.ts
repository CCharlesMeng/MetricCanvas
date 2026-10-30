import {test,expect} from '@playwright/test';

test('query join keeps a ten-row page, performs source replacement and has no idle full read',async({page})=>{
  await page.addInitScript(()=>{
    const calls:unknown[]=[];Object.assign(window,{pagedJoinCalls:calls});
    window.addEventListener('metriccanvas:synthetic-paged-join',event=>calls.push((event as CustomEvent).detail));
  });
  await page.goto('/pages/paged-join-on-demand');
  const table=page.locator('.runtime-view .table-widget');
  await expect(table).toContainText('总条数： 80');await expect(table.locator('tbody tr')).toHaveCount(10);
  const calls=()=>page.evaluate(()=>(window as typeof window&{pagedJoinCalls:Array<{pagination?:{limit:number;offset:number}}>}).pagedJoinCalls);
  await expect.poll(async()=>await calls()).toHaveLength(2);
  await page.waitForTimeout(150);expect(await calls()).toHaveLength(2);
  await table.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(table.locator('tbody tr').first()).toContainText('P000011');
  const state=table.locator('th[data-column-field="project-status"]');
  await state.locator('summary').click();
  await expect(state.getByRole('checkbox',{name:'已关闭',exact:true})).toBeVisible();
  await state.getByRole('checkbox',{name:'已关闭',exact:true}).click();
  await expect(table).toContainText('总条数： 40');
  await table.locator('th[data-column-field="approval-count"] button').first().click();
  await expect(table).toContainText('总条数： 80');
  expect((await calls()).every(query=>query.pagination?.limit===10)).toBe(true);
  await page.screenshot({path:test.info().outputPath('query-page.png'),fullPage:true});
});

test('record join preserves ten record rows and exposes unavailable empty filtering without clearing the page',async({page})=>{
  await page.goto('/pages/record-join-on-demand');
  const table=page.locator('.runtime-view .table-widget');
  await expect(table).toContainText('总条数： 1205');await expect(table.locator('tbody tr')).toHaveCount(10);
  const filter=table.locator('th details.filter').first();
  await filter.locator('summary').click();
  await filter.getByRole('button',{name:'为空',exact:true}).click();
  await expect(table.locator('p[role=status]')).toContainText('为空');
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await page.screenshot({path:test.info().outputPath('record-page.png'),fullPage:true});
});
