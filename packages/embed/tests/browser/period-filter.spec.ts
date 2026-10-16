import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
test.use({timezoneId:'Asia/Shanghai'});
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-10-15T12:00:00+08:00')});});
for(const precision of ['date','month'])test(`period selection queries, restoration and readonly rolling range (${precision})`,async({page},info)=>{
  const requests:any[]=[];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',async route=>{
    const items=route.request().postDataJSON().dsl_list;requests.push(...items);
    await route.fulfill({json:{retCode:'CBC.0000',results:items.map((q:any)=>({code:'SUCCESS',data:[{entry:`${q.filter.time.start}~${q.filter.time.end}`,[q.output_metrics[0]]:42}],total_count:1}))}});
  });
  const path='/pages/dashboard-period-filter'+(precision==='month'?'-month':'');
  if (precision === 'month') {
    const fixture = readFileSync(new URL('../../../page/fixtures/contract-valid/dashboard-period-filter-month.json', import.meta.url), 'utf8');
    await page.route('**/pages/dashboard-period-filter-month.json', route => route.fulfill({ contentType: 'application/json', body: fixture }));
  }
  await page.goto(path);
  const period=page.locator('[data-period-filter]');
  await expect(period.getByRole('combobox')).toHaveValue('2026-10');
  await expect.poll(()=>requests.length).toBe(2);
  await period.getByRole('button',{name:'季',exact:true}).click();
  const input=period.getByRole('combobox');await expect(input).toHaveValue('2026 年 Q4');
  await expect.poll(()=>requests.length).toBe(3);
  expect(requests.at(-1).filter.time).toMatchObject({start:precision==='month'?'2026-10':'2026-10-01',end:precision==='month'?'2026-12':'2026-12-31',is_aggregate:false});
  await input.click();await page.getByRole('button',{name:'2026-Q1',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(4);
  await period.getByRole('button',{name:'月',exact:true}).click();
  await period.getByRole('combobox').fill('2024-02');await period.getByRole('combobox').press('Enter');
  await expect(period.getByRole('combobox')).toHaveValue('2024-02');
  await expect.poll(()=>requests.filter(q=>q.filter.time.start===(precision==='month'?'2024-02':'2024-02-01')).length).toBe(1);
  await period.getByRole('button',{name:'近一年',exact:true}).click();
  await expect(period.locator('[data-period-range]')).toHaveText('25年10月~26年9月');
  await expect(period.getByRole('combobox')).toHaveCount(0);
  await expect(period.getByRole('button',{name:'打开日期选择器'})).toHaveCount(0);
  await expect.poll(()=>requests.at(-1).filter.time.end).toBe(precision==='month'?'2026-09':'2026-09-30');
  expect(requests.filter(q=>q.output_metrics[0]==='unbound_amount')).toHaveLength(1);
  await page.screenshot({path:info.outputPath('period-filter-rolling.png'),fullPage:true});
  await period.getByRole('button',{name:'月',exact:true}).click();await expect(period.getByRole('combobox')).toHaveValue('2024-02');
  await page.goto(path+'?period-filter=quarter%3A2025-Q2');await expect(period.getByRole('combobox')).toHaveValue('2025 年 Q2');
  await page.clock.setSystemTime(new Date('2026-11-01T12:00:00+08:00'));
  await period.getByRole('button',{name:'近一年',exact:true}).click();await expect(period.locator('[data-period-range]')).toHaveText('25年11月~26年10月');
  await page.setViewportSize({width:390,height:700});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
});
test('overflow panel and compact readonly consume the same period declaration',async({page},info)=>{
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',async route=>{
    const items=route.request().postDataJSON().dsl_list;
    await route.fulfill({json:{retCode:'CBC.0000',results:items.map(()=>({code:'SUCCESS',data:[],total_count:0}))}});
  });
  for (const variant of ['more', 'readonly']) {
    const fixture = readFileSync(new URL(`../../../page/fixtures/contract-valid/dashboard-period-filter-${variant}.json`, import.meta.url), 'utf8');
    await page.route(`**/pages/dashboard-period-filter-${variant}.json`, route => route.fulfill({ contentType: 'application/json', body: fixture }));
  }
  await page.goto('/pages/dashboard-period-filter-more');
  await page.getByText('更多筛选',{exact:true}).click();
  const period=page.locator('[data-period-filter]');await expect(period).toBeVisible();
  await period.getByRole('button',{name:'季',exact:true}).click();await period.getByRole('combobox').click();
  await expect(page.getByRole('button',{name:'2026-Q4',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:700});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  await page.goto('/pages/dashboard-period-filter-readonly');
  await expect(period).toContainText('25年10月~26年9月');
  await expect(period.locator('button,input')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  await page.screenshot({path:info.outputPath('period-readonly-compact.png'),fullPage:true});
});

test('default Dashboard period picker disables future years, quarters and months',async({page})=>{
  await page.clock.setSystemTime(new Date('2026-05-15T12:00:00+08:00'));
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',async route=>{
    const items=route.request().postDataJSON().dsl_list;
    await route.fulfill({json:{retCode:'CBC.0000',results:items.map(()=>({code:'SUCCESS',data:[],total_count:0}))}});
  });
  await page.goto('/pages/dashboard-period-filter?period-filter=quarter%3A2026-Q3');
  const period=page.locator('[data-period-filter]');await expect(period.getByRole('combobox')).toHaveValue('2026-05');
  await period.getByRole('button',{name:'季',exact:true}).click();await period.getByRole('combobox').click();
  await expect(page.getByRole('button',{name:'2026-Q2',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'2026-Q3',exact:true})).toBeDisabled();
  await period.getByRole('combobox').press('Escape');
  await period.getByRole('button',{name:'年',exact:true}).click();await period.getByRole('combobox').click();
  await expect(page.getByRole('button',{name:'2026',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'2027',exact:true})).toBeDisabled();
  await period.getByRole('combobox').press('Escape');
  await period.getByRole('button',{name:'月',exact:true}).click();await period.getByRole('combobox').click();
  await expect(page.getByRole('button',{name:'2026-05',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'2026-06',exact:true})).toBeDisabled();
});
