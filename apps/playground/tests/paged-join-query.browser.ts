import {test,expect} from '@playwright/test';
import document from '../../../pages/capabilities/table/paged-join-on-demand.json' with {type:'json'};

for(const nulls of ['first','last']){
  test(`nullable amount keeps backend nulls ${nulls} through sorting and paging`,async({page})=>{
    expect(document.dataSources['project-information'].fields['contract-amount'].nullable).toBe(true);
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`/pages/${document.id}?nulls=${nulls}`);
    const table=page.locator('.runtime-view .table-widget');
    await expect(table).toContainText('总条数： 80');
    const amount=table.locator('th[data-column-field="contract-amount"] button');
    await amount.click();
    await expect(amount.locator('.sort-state')).toHaveAttribute('aria-label','排序:asc');
    const cells=table.locator('tbody td[data-column-field="contract-amount"]');
    const keys=table.locator('tbody td[data-column-field="project-id"]');
    if(nulls==='first'){
      await expect(keys).toHaveText(['P000001','P000012','P000023','P000034','P000045','P000056','P000067','P000078','P000002','P000003']);
      await expect(cells.nth(0)).toHaveText('--');
      await expect(cells.nth(7)).toHaveText('--');
    }else await expect(keys).toHaveText(['P000002','P000003','P000004','P000005','P000006','P000007','P000008','P000009','P000010','P000011']);
    await table.getByRole('button',{name:'下一页',exact:true}).click();
    await expect(keys.first()).toHaveText(nulls==='first'?'P000004':'P000013');
    await amount.click();
    await expect(amount.locator('.sort-state')).toHaveAttribute('aria-label','排序:desc');
    await expect(keys.first()).toHaveText(nulls==='first'?'P000001':'P000080');
    await expect(table.locator('tbody tr')).toHaveCount(10);
    await expect(table).toContainText('总条数： 80');
    await page.screenshot({path:test.info().outputPath(`nulls-${nulls}.png`),fullPage:true});
    expect(errors).toEqual([]);
  });
}

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

test('preloads the supplementary member before opening its menu and supports explicit all',async({page})=>{
  await page.addInitScript(()=>{
    const requests:Array<{field:string;queryField:string}>=[];
    Object.assign(window,{joinCandidateRequests:requests});
    window.addEventListener('metriccanvas:synthetic-paged-join-candidates',event=>requests.push((event as CustomEvent).detail));
  });
  await page.goto(`/pages/${document.id}`);
  const table=page.locator('.runtime-view .table-widget');
  const requests=()=>page.evaluate(()=>(window as typeof window&{joinCandidateRequests:Array<{field:string;queryField:string}>}).joinCandidateRequests);
  await expect(table).toContainText('总条数： 80');
  await expect.poll(async()=>(await requests()).some(request=>request.field==='project-status'&&request.queryField==='项目状态')).toBe(true);
  const before=(await requests()).length;
  const status=table.locator('th[data-column-field="project-status"]');
  await status.locator('summary').click();
  await expect(status.getByRole('checkbox',{name:'已关闭',exact:true})).toBeVisible();
  await expect(status.getByRole('button',{name:'为空',exact:true})).toHaveCount(0);
  expect(await requests()).toHaveLength(before);
  await status.getByRole('checkbox',{name:'已关闭',exact:true}).check();
  await expect(table).toContainText('总条数： 40');
  await expect(status.locator('summary')).toHaveCSS('color','rgb(25, 25, 25)');
  await status.getByRole('checkbox',{name:'全选',exact:true}).check();
  await expect(table).toContainText('总条数： 80');
  await status.locator('summary').click();
  const names=table.locator('th[data-column-field="project-name"]');
  await names.locator('summary').click();
  await expect(names.getByRole('checkbox',{name:'全选',exact:true})).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('supplementary-candidates.png'),fullPage:true});
});

test('record join preserves ten record rows without offering unsupported empty filtering',async({page})=>{
  await page.goto('/pages/record-join-on-demand');
  const table=page.locator('.runtime-view .table-widget');
  await expect(table).toContainText('总条数： 1205');await expect(table.locator('tbody tr')).toHaveCount(10);
  const filter=table.locator('th details.filter').first();
  await filter.locator('summary').click();
  await expect(filter.locator('.menu')).toBeVisible();
  await expect(filter.getByRole('button',{name:'为空',exact:true})).toHaveCount(0);
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await page.screenshot({path:test.info().outputPath('record-page.png'),fullPage:true});
});
