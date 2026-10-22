import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
if(process.env.FILTER_GROUP_BASE_URL) test.use({baseURL:process.env.FILTER_GROUP_BASE_URL});

for(const width of [1440,390])test(`${width}: one fixed filter controls signed metrics and a chart; header visibility keeps applied state`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});
 const requests:any[]=[],errors:string[]=[];
 page.on('request',request=>{if(request.url().endsWith('/dsl/execute'))requests.push(...request.postDataJSON().dsl_list);});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/pages/filter-group-state-page');
 const group=page.locator('[data-filter-group="channel"]'),card=page.locator('[data-filter-group="card-region"]');
 const orders=page.locator('[data-component="metrics/orders-metric"]'),revenue=page.locator('[data-component="metrics/revenue-metric"]');
 const control=page.locator('[data-component="views/control"]'),trend=page.locator('[data-component="views/trend"]');
 await expect(group.getByRole('button',{name:'直营',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(orders).toContainText('+10');await expect(revenue).toContainText('+10');
 const initialRequests=requests.length,controlText=await control.innerText();
 await group.getByRole('button',{name:'加盟',exact:true}).click();
 await expect(orders).toContainText('+20');await expect(revenue).toContainText('+20');
 await expect.poll(()=>requests.length).toBe(initialRequests+2);
 expect(requests.slice(initialRequests).map(item=>item.output_metrics[0]).sort()).toEqual(['chart_demo_orders','chart_demo_revenue']);
 await expect(card.getByRole('button',{name:'中国区',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await control.innerText()).toBe(controlText);
 await expect(page).toHaveURL(/channel=OVERSEAS/);
 // The synthetic header enum needs no dimension-candidate request.
 expect(requests.every(item=>item.output_metrics.length===1)).toBe(true);
 await page.getByRole('button',{name:'业务范围',exact:true}).click();
 await page.getByRole('option',{name:'海外业务',exact:true}).click();
 await expect(group).toHaveCount(0);await expect(trend).toHaveCount(0);
 await expect(orders).toContainText('+20');await expect(revenue).toContainText('+20');
 await expect(page).toHaveURL(/channel=OVERSEAS/);
 expect(requests.length).toBe(initialRequests+2);
 await page.getByRole('button',{name:'业务范围',exact:true}).click();
 await page.getByRole('option',{name:'国内业务',exact:true}).click();
 await expect(group.getByRole('button',{name:'加盟',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(trend).toBeVisible();
 expect(requests.length).toBe(initialRequests+2);
 await card.getByRole('button',{name:'海外',exact:true}).click();
 await expect(page.locator('[data-component="nested/nested-card"]')).toContainText('+20');
 await expect(orders).toContainText('+20');
 await page.reload();
 await expect(group.getByRole('button',{name:'加盟',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(card.getByRole('button',{name:'海外',exact:true})).toHaveAttribute('aria-pressed','true');
 const overflow=await group.evaluate(element=>element.scrollWidth>element.clientWidth+1);expect(overflow).toBe(false);
 expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('filter-group.png'),fullPage:true});
});

test('page readOnly disables standalone and nested controls',async({page})=>{
 const document=JSON.parse(readFileSync(new URL('../../../../pages/filter-group-state-page.json',import.meta.url),'utf8'));
 document.dashboardToolbar={variant:'compact',readOnly:true};
 await page.route('**/pages/filter-group-state-page.json',route=>route.fulfill({json:document}));
 await page.goto('/pages/filter-group-state-page');
 for(const id of ['channel','card-region']){
  const buttons=page.locator(`[data-filter-group="${id}"] button`);await expect(buttons).toHaveCount(2);
  for(const button of await buttons.all())await expect(button).toBeDisabled();
 }
});
