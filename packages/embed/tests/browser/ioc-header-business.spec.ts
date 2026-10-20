import {test,expect} from '@playwright/test';
test.use({timezoneId:'Asia/Shanghai'});
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-10-19T12:00:00+08:00')});});
const endpoint='/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
test('closed enums preserve UI codes, single choice, all-unrestricted, and boolean false',async({page},info)=>{
  const queries:any[]=[];let candidateRequests=0;page.on('request',request=>{if(request.url().includes('/__fixtures/filter-candidates'))candidateRequests++;if(request.url().includes(endpoint)&&request.method()==='POST')queries.push(...request.postDataJSON().dsl_list);});
  await page.goto('/pages/ioc-header-business-options-demo');const header=page.locator('[data-ioc-header]');
  await expect(page.getByText(/合成 · .*customer_kind=A.*focus_flag=1/)).toBeVisible();await header.getByRole('checkbox',{name:'仅看重点',exact:true}).uncheck();await expect(page.getByText(/合成 · .*focus_flag=0/)).toBeVisible();
  const initial=queries.find(query=>query.filter?.time);expect(initial.filter.dims.some((item:any)=>item.dim_name==='breakthrough')).toBe(false);expect(candidateRequests).toBe(0);
  const kind=header.locator('[data-filter-id="kind"]');await kind.getByRole('button',{name:'客户分类',exact:true}).click();await expect(kind.getByRole('option',{name:'停用档位'})).toBeDisabled();await kind.getByRole('option',{name:'一般客户'}).click();await expect(header).toContainText('等待筛选确认');
  const cleared=header.locator('[data-filter-id="breakthrough"]');await cleared.locator('summary').click();await cleared.getByRole('button',{name:'全选',exact:true}).click();await expect(page.getByText(/合成 · .*customer_kind=B/)).toBeVisible();await cleared.locator('summary').click();
  const all=header.locator('[data-filter-id="breakthrough"]');await all.locator('summary').click();await all.getByRole('checkbox',{name:'否',exact:true}).uncheck();await expect(page.getByText(/合成 · .*breakthrough=1/)).toBeVisible();await all.getByRole('button',{name:'全选',exact:true}).click();await expect(page.getByText(/合成 · .*breakthrough=/)).toHaveCount(0);expect(new URL(page.url()).searchParams.getAll('breakthrough')).toEqual(['1','0']);
  await header.getByRole('checkbox',{name:'仅看重点',exact:true}).check();await expect(page.getByText(/合成 · .*focus_flag=1/)).toBeVisible();
  expect(candidateRequests).toBe(0);await expect(header.locator('[data-filter-hint]').first()).toContainText('2026-09');
  await page.setViewportSize({width:390,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath('business-options-390.png'),fullPage:true});
});
test('explicit structure tree has own values per level; legacy tree still selects leaves',async({page},info)=>{
  await page.goto('/pages/ioc-header-business-tree-demo');const header=page.locator('[data-ioc-header]');if(await header.getByRole('button',{name:'展开筛选'}).count())await header.getByRole('button',{name:'展开筛选'}).click();
  const region=header.locator('[data-filter-id="region"]');await expect(page.getByText(/合成 · .*department_code=same/)).toBeVisible();await region.locator('summary').click();await expect(region.getByRole('checkbox',{name:'北部地区部',exact:true})).toBeChecked();await expect(region.getByRole('checkbox',{name:'北京代表处',exact:true})).toHaveCount(0);
  await region.getByRole('tab',{name:'代表处',exact:true}).click();if(await region.locator('details').getAttribute('open')===null)await region.locator('summary').click();await region.getByRole('checkbox',{name:'北京代表处',exact:true}).check();await expect(page.getByText(/合成 · .*office_code=same/)).toBeVisible();
  const legacy=header.locator('[data-filter-id="legacy"]');await legacy.locator('summary').click();await legacy.getByText('North',{exact:true}).click();await expect(page.getByText(/合成 · .*legacy_path=North\/One,North\/Two/)).toBeVisible();
  await page.setViewportSize({width:390,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:info.outputPath('business-tree-390.png'),fullPage:true});
});
test('time context intersects trusted candidates; empty intersection waits explicit clear; denied and unconfigured remain gated',async({page})=>{
  const requests:any[]=[];const candidateRequests:any[]=[];page.on('request',r=>{if(r.url().includes(endpoint)&&r.method()==='POST')requests.push(...r.postDataJSON().dsl_list);if(r.url().includes('/__fixtures/filter-candidates'))candidateRequests.push(r.postDataJSON());});
  await page.goto('/pages/ioc-header-business-tree-demo');const header=page.locator('[data-ioc-header]');await expect(page.getByText(/合成 · .*model_code=A,B/)).toBeVisible();
  if(await header.getByRole('button',{name:'展开筛选'}).count())await header.getByRole('button',{name:'展开筛选'}).click();
  const period=header.locator('[data-period-filter]');const model=header.locator('[data-filter-id="model"]');
  const month=period.getByRole('combobox');await month.fill('2026-08');await month.press('Enter');await expect(page.getByText(/合成 · 2026-08.*model_code=B/)).toBeVisible();expect(candidateRequests.find(r=>r.filterId==='model'&&r.constraints.times.period.from==='2026-08')).toBeTruthy();
  const count=requests.filter(q=>q.filter?.time).length;await month.fill('2026-07');await month.press('Enter');await expect(header).toContainText('等待筛选确认');expect(requests.filter(q=>q.filter?.time)).toHaveLength(count);await expect(page.getByRole('button',{name:'导出',exact:true}).first()).toBeDisabled();
  await model.locator('summary').click();await model.getByRole('button',{name:'清除筛选',exact:true}).click();await expect(page.getByText(/合成 · 2026-07/)).toBeVisible();
  await month.fill('2026-06');await month.press('Enter');await expect(model.locator('[data-candidates-status="denied"]')).toBeVisible();await expect(page.getByRole('button',{name:'导出',exact:true}).first()).toBeDisabled();
  await month.fill('2026-05');await month.press('Enter');await expect(model.locator('[data-candidates-status="unconfigured"]')).toBeVisible();await expect(page.getByRole('button',{name:'导出',exact:true}).first()).toBeDisabled();
});
test('detail enum stays private and single month still emits compact mtime',async({page})=>{
  await page.goto('/pages/ioc-header-business-detail-demo');const kind=page.locator('[data-filter-id="detail-kind"]');await kind.getByRole('button',{name:'详情档位',exact:true}).click();await kind.getByRole('option',{name:'详情二级'}).click();await expect(page.getByText(/合成 · .*detail_kind=L2/)).toBeVisible();
  const month=page.locator('[data-filter-id="month"]').getByRole('combobox');await month.fill('2026-08');await month.press('Enter');await expect(page.getByText(/合成 · .*mtime=202608.*detail_kind=L2/)).toBeVisible();await expect(page.getByRole('button',{name:'返回来源页'})).toHaveCount(0);
});
test('required structural tree drafts a new level until one value can be committed atomically',async({page})=>{
  await page.route('**/pages/ioc-header-business-tree-demo.json',async route=>{const response=await route.fetch();const doc=await response.json();doc.filters.find((f:any)=>f.id==='region').selection={mode:'single',required:true};await route.fulfill({response,json:doc});});
  const queries:any[]=[];page.on('request',r=>{if(r.url().includes(endpoint)&&r.method()==='POST')queries.push(...r.postDataJSON().dsl_list);});
  await page.goto('/pages/ioc-header-business-tree-demo');const header=page.locator('[data-ioc-header]');await expect(page.getByText(/合成 · .*department_code=same/)).toBeVisible();
  if(await header.getByRole('button',{name:'展开筛选'}).count())await header.getByRole('button',{name:'展开筛选'}).click();
  const region=header.locator('[data-filter-id="region"]'),before=queries.length;await region.getByRole('tab',{name:'代表处',exact:true}).click();expect(queries).toHaveLength(before);
  await region.locator('summary').click();await region.getByRole('checkbox',{name:'北京代表处',exact:true}).check();await expect(page.getByText(/合成 · .*office_code=same/)).toBeVisible();await expect(region.getByRole('checkbox',{name:'北京代表处',exact:true})).toBeChecked();await expect(region.getByRole('checkbox',{name:'北京代表处',exact:true})).toBeDisabled();expect(new URL(page.url()).searchParams.get('region.level')).toBe('office');
});
