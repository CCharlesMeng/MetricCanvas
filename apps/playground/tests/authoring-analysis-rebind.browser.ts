import {expect,test} from '@playwright/test';

test('shared-source association baseline renders two consumers and an independent control',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/pages/authoring-analysis-rebind');
  for(const id of ['sales-main','sales-shared']) {
    const table=page.locator(`[data-component="shared/${id}"]`);
    await expect(table).toContainText('CN');await expect(table).toContainText('EU');
    await expect(table.getByText('10.00',{exact:true})).toBeVisible();
    await expect(table.getByText('20.00',{exact:true})).toBeVisible();
  }
  const control=page.locator('[data-component="control-section/control-table"]');
  await expect(control).toContainText('CONTROL');await expect(control.getByText('999.00',{exact:true})).toBeVisible();
  await page.screenshot({path:'/tmp/authoring-analysis-rebind-wide.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(control.getByText('999.00',{exact:true})).toBeVisible();
  await page.screenshot({path:'/tmp/authoring-analysis-rebind-narrow.png',fullPage:true});
  expect(errors).toEqual([]);
});
