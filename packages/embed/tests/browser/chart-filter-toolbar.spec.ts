import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
if(process.env.FILTER_GROUP_BASE_URL)test.use({baseURL:process.env.FILTER_GROUP_BASE_URL});

for(const width of [1440,390])test(`${width}: chart buttons and right dropdown share query state`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});
 const errors:string[]=[],requests:any[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.url().endsWith('/dsl/execute'))requests.push(...request.postDataJSON().dsl_list);});
 await page.goto('/pages/filter-group-page');
 const metric=page.locator('[data-filter-group="metric"]'),region=page.locator('[data-filter-group="region"]');
 const total=()=>page.locator('[data-component="trend/chart-card"]');
 await expect(total()).toContainText('1,710');
 await expect(page.locator('.echart canvas')).toHaveCount(1);
 expect(await page.locator('.echart canvas').evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThan(200);
 await expect.poll(()=>requests.length).toBe(2);
 if(width>600){
  const left=(await metric.boundingBox())!,right=(await region.getByRole('button',{name:'区域',exact:true}).boundingBox())!;
  expect(Math.abs(left.y-right.y)).toBeLessThan(10);expect(right.x).toBeGreaterThan(left.x+left.width);
 }
 await metric.getByRole('button',{name:'订单量',exact:true}).click();
 await expect(total()).toContainText('5,579');await expect.poll(()=>requests.length).toBe(4);
 await region.getByRole('button',{name:'区域',exact:true}).click();
 await page.getByRole('option',{name:'华东',exact:true}).click();
 await expect(total()).toContainText('3,095');await expect.poll(()=>requests.length).toBe(6);
 for(const item of requests.slice(-2))expect(item.filter.dims).toEqual(expect.arrayContaining([
  expect.objectContaining({dim_name:'toolbar_metric',dim_value_list:['orders']}),expect.objectContaining({dim_name:'toolbar_region',dim_value_list:['east']})
 ]));
 await expect(page).toHaveURL(/metric=orders/);await expect(page).toHaveURL(/region=east/);
 await page.reload();await expect(total()).toContainText('3,095');
 await expect(metric.getByRole('button',{name:'订单量',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(region).toContainText('华东');
 await metric.getByRole('button',{name:'营业收入',exact:true}).click();await expect(total()).toContainText('951');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
 expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('chart-filter-toolbar.png'),fullPage:true});
});

test('invalid fixed selections fall back and readOnly disables both presentations',async({page})=>{
 await page.goto('/pages/filter-group-page?metric=unknown&region=east&region=south');
 await expect(page.locator('[data-filter-group="metric"] button[aria-pressed=true]')).toHaveText('营业收入');
 await expect(page.locator('[data-filter-group="region"]')).toContainText('全部区域');
 const document=JSON.parse(readFileSync(new URL('../../../../pages/filter-group-page.json',import.meta.url),'utf8'));
 document.dashboardToolbar={readOnly:true};
 await page.route('**/pages/filter-group-page.json',route=>route.fulfill({json:document}));
 await page.goto('/pages/filter-group-page');
 for(const button of await page.locator('[data-filter-group] button').all())await expect(button).toBeDisabled();
});
