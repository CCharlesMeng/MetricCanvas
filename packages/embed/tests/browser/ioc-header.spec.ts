import { expect,test } from '@playwright/test';
test.use({timezoneId:'Asia/Shanghai'});
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-10-19T12:00:00+08:00')});});
const endpoint='/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
test('ordinary header consumes its real page, period anchor and queries; narrow layout',async({page},info)=>{
  const requests:any[]=[];page.on('request',request=>{if(request.url().includes(endpoint)&&request.method()==='POST')requests.push(...request.postDataJSON().dsl_list);});
  await page.goto('/pages/ioc-header-overview-demo');const header=page.locator('[data-ioc-header]'),period=header.locator('[data-period-filter]');
  await expect(header.getByRole('heading',{name:'项目概览'})).toBeVisible();await expect(page.locator('[data-filter-id="region"]')).toHaveCount(1);await expect(page.getByText('合成 · 2026-09 至 2026-09',{exact:true})).toBeVisible();
  await period.getByRole('button',{name:'季',exact:true}).click();await expect(period.getByRole('combobox')).toHaveValue('2026 年 Q3');
  await period.getByRole('button',{name:'年',exact:true}).click();await period.getByRole('button',{name:'月',exact:true}).click();await expect(period.getByRole('combobox')).toHaveValue('2026-09');
  await period.getByRole('button',{name:'近一年',exact:true}).click();await expect(header.locator('[data-ioc-fact="period"]')).toContainText('2025-10 至 2026-09');
  await expect.poll(()=>requests.filter(q=>q.filter?.time?.start==='2025-10'&&q.filter.time.end==='2026-09').length).toBe(1);
  expect(requests.filter(q=>q.output_dims[0]==='ioc_header_scope' && !q.filter?.time && !(q.filter?.dims?.length))).toHaveLength(1);
  await period.getByRole('button',{name:'月',exact:true}).click();await expect(period.getByRole('combobox')).toHaveValue('2026-09');
  const geometry=await header.evaluate(node=>{const s=getComputedStyle(node),title=node.querySelector('h1')!;const t=getComputedStyle(title);return [s.paddingTop,s.paddingLeft,t.fontSize,t.lineHeight];});expect(geometry).toEqual(['22px','32px','24px','36px']);
  for(const width of [1440,1024,390]){await page.setViewportSize({width,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath(`overview-${width}.png`),fullPage:true});}
});
test('dense measured collapse, candidate retry, recursive gate and export safety',async({page},info)=>{
  const requests:any[]=[];page.on('request',request=>{if(request.url().includes(endpoint)&&request.method()==='POST')requests.push(...request.postDataJSON().dsl_list);});
  await page.setViewportSize({width:1024,height:900});await page.goto('/pages/ioc-header-dense-filter-demo');
  const header=page.locator('[data-ioc-header]');await expect(header.getByRole('button',{name:'展开筛选'})).toBeVisible();
  const before=requests.length;await header.getByRole('button',{name:'展开筛选'}).click();await header.getByRole('button',{name:'收起筛选'}).click();expect(requests.length).toBe(before);
  expect(await header.locator('[data-ioc-filter][inert]').count()).toBeGreaterThan(0);
  await header.getByRole('button',{name:'展开筛选'}).click();
  const region=header.locator('[data-filter-id="region"]');await region.locator('summary').click();await region.getByRole('checkbox',{name:'中国',exact:true}).check();
  await expect(header).toContainText('等待筛选确认或可信候选');
  // Automatic descendant clearing must not execute the bound query or its export without confirmation.
  const afterRegion=requests.filter(q=>q.output_dims[0]==='ioc_header_scope').length;
  await expect(page.getByRole('button',{name:'导出',exact:true}).first()).toBeDisabled();
  expect(requests.filter(q=>q.output_dims[0]==='ioc_header_scope').length).toBe(afterRegion);
  const department=header.locator('[data-filter-id="department"]');await department.locator('summary').click();await department.getByRole('checkbox',{name:'华北地区部',exact:true}).check();
  const office=header.locator('[data-filter-id="office"]');await office.locator('summary').click();await office.getByRole('checkbox').first().check();
  await expect(header).not.toContainText('等待筛选确认');await expect(page.getByText(/合成 · .*region_dept_code=CN-NORTH/)).toBeVisible();
  await header.getByRole('button',{name:'收起筛选'}).click();expect(await header.locator('details[open]').count()).toBe(0);
  await page.setViewportSize({width:390,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath('dense-390.png'),fullPage:true});
  await header.getByRole('button',{name:'展开筛选'}).click();
  const expanded=await header.evaluate(node=>({left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right,scroll:node.scrollWidth,width:node.clientWidth,inert:node.querySelectorAll('[data-ioc-filter][inert]').length}));
  expect(expanded.left).toBeGreaterThanOrEqual(0);expect(expanded.right).toBeLessThanOrEqual(390);expect(expanded.scroll).toBe(expanded.width);expect(expanded.inert).toBe(0);
  await region.locator('summary').click();await expect(region.getByRole('checkbox',{name:'中国',exact:true})).toBeVisible();
  const menu=await region.locator('details').evaluate(node=>({left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right}));expect(menu.left).toBeGreaterThanOrEqual(0);expect(menu.right).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:info.outputPath('dense-390-expanded.png'),fullPage:true});
  await header.getByRole('button',{name:'收起筛选'}).click();expect(await header.locator('details[open]').count()).toBe(0);
});
test('detail single month, optional facts, legal back intent and readonly update',async({page},info)=>{
  await page.goto('/pages/ioc-header-detail-demo');const header=page.locator('[data-ioc-header]');await expect(header.locator('[data-ioc-tag]')).toHaveCount(1);await expect(header.locator('[data-ioc-fact]')).toHaveCount(1);await expect(header.getByRole('button',{name:'返回来源页'})).toHaveCount(0);
  const month=header.getByRole('combobox');await month.fill('2026-08');await month.press('Enter');await expect(header.locator('[data-ioc-fact]')).toContainText('2026-08');await expect(page.getByText(/mtime=202608/)).toBeVisible();
  await header.getByRole('button',{name:'打开日期选择器'}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(()=>{const w=window as any;w.backCount=0;w.runtime.update({document:w.pageDocument,dataGateway:w.dataGateway,initialSearch:location.search,filterEditing:{readOnly:true,reason:'验收只读'},navigation:{returnContext:{entryId:'source-entry'},back:()=>w.backCount++}});});
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(header.getByRole('combobox')).toBeDisabled();await expect(header).toContainText('验收只读');await header.getByRole('button',{name:'返回来源页'}).click();expect(await page.evaluate(()=>(window as any).backCount)).toBe(1);
  await page.setViewportSize({width:390,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath('detail-390.png'),fullPage:true});
});
test('titleless header keeps a discrete January/March predicate',async({page})=>{
  await page.goto('/pages/ioc-header-month-set-demo');const header=page.locator('[data-ioc-header]');await expect(header.getByRole('heading')).toHaveCount(0);const month=header.locator('[data-filter-id="months"]');await month.locator('summary').click();await month.getByRole('checkbox',{name:'2026-01',exact:true}).check();await month.getByRole('checkbox',{name:'2026-03',exact:true}).check();await expect(page.getByText('合成 · month_code=2026-01,2026-03',{exact:true})).toBeVisible();
});

test('selected URL value waits for candidates; failed candidates retry current request without broadening',async({page})=>{
  const business:any[]=[];let failed=false;
  await page.route('**'+endpoint,async route=>{
    const items=route.request().postDataJSON().dsl_list;
    if(items.some((item:any)=>item.output_dims[0]==='geo-pc-code'&&!item.output_metrics.length)&&!failed){failed=true;await route.fulfill({status:503,body:'fixture failure'});return;}
    business.push(...items.filter((item:any)=>item.output_dims[0]==='ioc_header_scope'&&item.filter?.time));await route.continue();
  });
  await page.goto('/pages/ioc-header-overview-demo?region=R99');const region=page.locator('[data-filter-id="region"]');await region.locator('summary').click();await expect(region.locator('[data-candidates-status="error"]')).toBeVisible();expect(business).toHaveLength(0);
  await region.getByRole('button',{name:'重试',exact:true}).click();await expect(region.getByRole('checkbox',{name:'中国',exact:true})).toBeChecked();await expect(page.getByText(/合成 · .*geo_pc_code=R99/)).toBeVisible();expect(business).toHaveLength(1);
});

test('two embedded instances own their month anchors and destroy independently',async({page})=>{
  await page.goto('/pages/ioc-header-overview-demo');
  await page.evaluate(()=>{const w=window as any;const target=document.createElement('main');target.id='second-ioc';document.body.append(target);w.secondRuntime=MetricCanvas.mount(target,{document:w.pageDocument,dataGateway:w.dataGateway});});
  const first=page.locator('#dashboard [data-period-filter]'),second=page.locator('#second-ioc [data-period-filter]');await expect(second.getByRole('combobox')).toHaveValue('2026-09');
  await first.getByRole('combobox').fill('2026-08');await first.getByRole('combobox').press('Enter');await first.getByRole('button',{name:'季',exact:true}).click();await first.getByRole('button',{name:'月',exact:true}).click();await expect(first.getByRole('combobox')).toHaveValue('2026-08');await expect(second.getByRole('combobox')).toHaveValue('2026-09');
  await page.evaluate(()=>window.runtime.destroy());await expect(page.locator('#dashboard [data-ioc-header]')).toHaveCount(0);await expect(second.getByRole('combobox')).toHaveValue('2026-09');
});
