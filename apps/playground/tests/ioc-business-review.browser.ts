import {expect,test} from '@playwright/test';
import {openSelection} from '../../../packages/embed/tests/browser/selection-actions';
test('seven real review pages render and retain narrow wrapping',async({page},info)=>{
 const failures:string[]=[];page.on('pageerror',error=>failures.push(error.message));
 for(const id of ['business','models','groups','incentives','currency','months','unconfigured']){
  await page.goto(`/ioc-header-review?view=ioc-header-${id}`);await expect(page.locator('[data-ioc-header] h1')).toBeVisible();
  await expect(page.getByText('验收页面加载失败')).toHaveCount(0);
 }
 const header=page.locator('[data-ioc-header]');await expect(header.locator('[data-dashboard-back]')).toHaveText('<');
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:900});await page.goto('/ioc-header-review?view=ioc-header-business');await expect(page.locator('[data-filter-id="sector"] button[aria-haspopup]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath(`batch-${width}.png`),fullPage:true});
 }
 expect(failures).toEqual([]);
});
test('region department and office each select one stable code',async({page})=>{
 await page.goto('/ioc-header-review?view=ioc-header-models');const region=page.locator('[data-filter-id="region"]');await openSelection(region);
 await region.getByRole('button',{name:'示例地区部',exact:true}).click();await expect(region.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('R',{exact:true})).toBeVisible();
 await region.getByRole('tab',{name:'代表处',exact:true}).click();await openSelection(region);await region.getByRole('textbox').fill('示例代表处一');await region.getByRole('button',{name:'示例代表处一',exact:true}).click();
 await expect(region.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('R01',{exact:true})).toBeVisible();await expect(page.getByText('R',{exact:true})).toHaveCount(0);
});
test('model retries preserve dates and unrelated changes do not refetch',async({page})=>{
 await page.goto('/ioc-header-review?view=ioc-header-models');await expect(page.getByText('模型候选请求次数',{exact:true})).toBeVisible();
 const counter=page.locator('tr').filter({hasText:'模型候选请求次数'});await expect(counter).toContainText('1');
 await page.getByRole('checkbox',{name:'重点样例'}).check();await expect(counter).toContainText('1');
 const select=page.getByLabel('合成输入场景',{exact:true});await select.click();await page.getByRole('option',{name:'失败与重试',exact:true}).click();const model=page.locator('[data-filter-id="model"]');await openSelection(model);await model.getByRole('button',{name:/重试/}).click();await expect(model.getByText('候选项加载失败',{exact:false})).toHaveCount(0);
 await expect(page.getByText('2026-09-01 ~ 2026-09-30',{exact:true})).toBeVisible();
});
test('currency presets keep draft cancellation, strict bounds, and atomic clearing',async({page})=>{
 await page.goto('/ioc-header-review?view=ioc-header-currency');let amount=page.locator('[data-filter-id="amount"]');await amount.getByLabel('预签金额',{exact:true}).click();await amount.getByRole('button',{name:'2百万￥~1千万￥',exact:true}).click();await amount.getByRole('button',{name:'确定',exact:true}).click();
 await expect(page.getByText('2000000 ~ 10000000',{exact:true})).toBeVisible();
 await amount.getByLabel('预签金额',{exact:true}).click();await amount.getByLabel('预签金额下限').fill('3000000');await amount.getByRole('button',{name:'取消',exact:true}).click();await expect(page.getByText('2000000 ~ 10000000',{exact:true})).toBeVisible();
 const currency=page.locator('[data-filter-id="currency"]');await openSelection(currency);await currency.getByRole('option',{name:'美元',exact:true}).click();amount=page.locator('[data-filter-id="amount"]');await amount.getByLabel('预签金额',{exact:true}).click();await expect(amount.getByRole('button',{name:'1M$~10M$',exact:true})).toBeVisible();await expect(page.getByText('2000000 ~ 10000000',{exact:true})).toHaveCount(0);
 await amount.getByLabel('预签金额下限').fill('10');await amount.getByLabel('预签金额上限').fill('10');await amount.getByRole('button',{name:'确定',exact:true}).click();await expect(amount.getByRole('alert')).toBeVisible();await amount.getByRole('button',{name:'1M$~10M$',exact:true}).click();await amount.getByRole('button',{name:'确定',exact:true}).click();await expect(page.getByText('1000000 ~ 10000000',{exact:true})).toBeVisible();await expect(page.getByText('demo_amount_usd',{exact:true})).toBeVisible();
});
test('months remain discrete, required multi can add and remove without clearing last',async({page})=>{
 await page.goto('/ioc-header-review?view=ioc-header-months');await expect(page.getByText('202610 | 202608',{exact:true})).toBeVisible();const months=page.locator('[data-filter-id="months"]');await openSelection(months);
 await months.getByRole('option',{name:'2026年9月',exact:true}).click();await expect(page.getByText('202610 | 202608 | 202609',{exact:true})).toBeVisible();
 await months.getByRole('option',{name:'2026年10月',exact:true}).click();await months.getByRole('option',{name:'2026年8月',exact:true}).click();await months.getByRole('option',{name:'2026年9月',exact:true}).click();await expect(page.getByText('202609',{exact:true})).toBeVisible();
});
test('permission and configuration failures gate related body while unrelated inline remains',async({page})=>{
 await page.goto('/ioc-header-review?view=ioc-header-groups');await expect(page.getByText('GROUP-A',{exact:true})).toBeVisible();await page.getByLabel('合成输入场景',{exact:true}).click();await page.getByRole('option',{name:'无权限',exact:true}).click();
 const groups=page.locator('[data-filter-id="group"]');await openSelection(groups);await expect(groups.getByText('无权访问候选项',{exact:true})).toBeVisible();await expect(page.locator('td').getByText('GROUP-A',{exact:true})).toHaveCount(0);
 await page.goto('/ioc-header-review?view=ioc-header-unconfigured');await expect(page.getByText('仍可阅读',{exact:true})).toBeVisible();
});
test('independent candidate dictionaries load and strategy selection month does not refetch',async({page})=>{
 await page.goto('/ioc-header-review?view=ioc-header-business');const sector=page.locator('[data-filter-id="sector"]');await openSelection(sector);await expect(sector.getByRole('option',{name:'示例产业甲',exact:true})).toBeVisible();
 await page.goto('/ioc-header-review?view=ioc-header-incentives');const counter=page.locator('tr').filter({hasText:'候选预拉日历月'});await expect(counter).toContainText('2026-10');
 const month=page.locator('[data-filter-id="month"]').getByRole('combobox');await month.fill('2026-07');await month.press('Enter');await expect(page.getByText('2026-07',{exact:true})).toBeVisible();await expect(counter.locator('td').last()).toHaveText('1');
});
test('slow superseded model responses cannot restore an old date selection',async({page})=>{
 await page.goto('/ioc-header-review?view=ioc-header-models');await page.getByLabel('合成输入场景',{exact:true}).click();await page.getByRole('option',{name:'慢请求',exact:true}).click();
 const start=page.getByLabel('统计范围开始',{exact:true}),end=page.getByLabel('统计范围结束',{exact:true});await start.fill('2026-08-01');await start.press('Enter');await end.fill('2026-08-31');await end.press('Enter');
 const model=page.locator('[data-filter-id="model"]');await openSelection(model);await expect(model.getByRole('option',{name:'模型 2026-08-31',exact:true})).toBeVisible();await expect(model.getByRole('option',{name:'模型 2026-09-30',exact:true})).toHaveCount(0);await model.getByRole('option',{name:'模型 2026-08-31',exact:true}).click();await expect(page.getByText('MODEL-2026-08-31',{exact:true})).toBeVisible();
});

test('additional formal header pages run directly with the canonical period facts',async({page})=>{
 for(const id of ['standard','dense','detail','time','inputs']){
  await page.goto(`/pages/ioc-header-${id}?project-name=示例项目`);await expect(page.locator('[data-ioc-header] h1')).toBeVisible();await expect(page.getByText('页面加载失败',{exact:true})).toHaveCount(0);
 }
 await expect(page.getByText('合成模型结果',{exact:true})).toBeVisible();await expect(page.locator('[data-filter-id="month"]').getByRole('combobox')).toHaveValue('2026-10');
});
