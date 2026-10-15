import { expect, test, type Locator } from '@playwright/test';

const expectSelected = (group: Locator, value: string) => expect(group.locator(`button[data-value="${value}"]`)).toHaveAttribute('aria-pressed', 'true');
const choose = (group: Locator, value: string) => group.locator(`button[data-value="${value}"]`).click();

for (const width of [1440, 390]) test(`${width}: chart filters refresh only their owner and export captured choices`, async ({page}, info) => {
  await page.setViewportSize({width,height:1000});
  const requests: any[] = [];
  page.on('request', request => {
    if (request.url().endsWith('/dsl/execute')) requests.push(...request.postDataJSON().dsl_list);
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/pages/chart-local-filter-page');
  await expect(page.locator('[data-chart-filter][role=group]')).toHaveCount(4);
  const orders = page.getByRole('group', {name:'订单对比筛选',exact:true});
  const revenue = page.getByRole('group', {name:'收入趋势筛选',exact:true});
  const share = page.getByRole('group', {name:'渠道占比筛选',exact:true});
  const map = page.getByRole('group', {name:'区域分布筛选',exact:true});
  const orderCell = page.locator('[data-component="charts/orders"]');
  await expectSelected(orders, 'CN'); await expectSelected(revenue, 'OVERSEAS');
  await expectSelected(share, 'APAC'); await expectSelected(map, 'CN');
  await expect(orders.getByRole('button', {pressed:true})).toHaveCSS('background-color', 'rgb(25, 25, 25)');
  await expect(orders.getByRole('button', {pressed:true})).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(orders.getByRole('button', {pressed:true})).toHaveCSS('border-top-left-radius', '6px');
  await expect(orders.getByRole('button', {pressed:true})).toHaveCSS('height', '28px');
  await expect(orders.getByRole('button', {pressed:false})).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect(page.locator('[data-chart-filter] select')).toHaveCount(0);
  for (const group of [orders, revenue, share, map]) await expect(group.getByRole('button', {pressed:true})).toHaveCount(1);
  await expect(orderCell.locator('.chart-semantics')).toContainText('国内一组');
  await expect.poll(() => requests.length).toBe(5);
  // Configured options do not fetch candidate values or appear in the page toolbar.
  expect(requests.every(item => item.output_metrics.length === 1)).toBe(true);
  const renderFacts = await page.locator('[data-chart-filter][role=group]').evaluateAll(groups => groups.map(group => {
    const cell = group.closest('article')!.getBoundingClientRect();
    const groupRect = group.getBoundingClientRect();
    const buttons = [...group.querySelectorAll('button')].map(button => {
      const r = button.getBoundingClientRect(), style = getComputedStyle(button);
      return {label:button.textContent?.trim(),pressed:button.getAttribute('aria-pressed'),x:r.x,y:r.y,width:r.width,height:r.height,fontSize:style.fontSize,paddingLeft:style.paddingLeft,paddingRight:style.paddingRight,radius:style.borderRadius,background:style.backgroundColor,color:style.color,overflow:button.scrollWidth > button.clientWidth+1};
    });
    return {id:group.getAttribute('data-chart-filter'),inside:groupRect.left>=cell.left && groupRect.right<=cell.right,buttons};
  }));
  for (const group of renderFacts) {
    expect(group.inside).toBe(true);
    expect(group.buttons.every(button => !button.overflow)).toBe(true);
    for (let i=0; i<group.buttons.length; i++) for (let j=i+1; j<group.buttons.length; j++) {
      const a=group.buttons[i], b=group.buttons[j];
      expect(a.x < b.x+b.width && b.x < a.x+a.width && a.y < b.y+b.height && b.y < a.y+a.height).toBe(false);
    }
  }
  const {writeFile} = await import('node:fs/promises');
  await writeFile(info.outputPath('button-group-render-facts.json'), JSON.stringify({viewport:{width,height:1000},groups:renderFacts},null,2));
  await page.screenshot({path:info.outputPath('button-group-initial.png'),clip:{x:0,y:0,width,height:width<500?480:450}});

  await orders.locator('button[data-value=OVERSEAS]').press('Enter');
  await expect(orderCell.locator('.chart-semantics')).toContainText('海外一组');
  await expect.poll(() => requests.length).toBe(6);
  expect(requests[5].output_metrics).toEqual(['chart_demo_orders']);
  await choose(orders, 'OVERSEAS'); // Re-selecting the active option does not submit again.
  expect(requests).toHaveLength(6);
  expect(requests[5].filter.dims).toEqual([{dim_name:'chart_demo_region',dim_value_list:['OVERSEAS']}]);
  await expectSelected(revenue, 'OVERSEAS'); await expectSelected(share, 'APAC');
  await expect(page.locator('[data-component="charts/control"] .chart-semantics')).toContainText('国内一组');
  await expect(page).toHaveURL(/orders-region=OVERSEAS/);
  await choose(share, 'EU');
  await expect.poll(() => requests.length).toBe(7);
  await expectSelected(share, 'EU');
  await expect(page.locator('[data-component="charts/share"]')).toContainText('渠道占比');
  await choose(revenue, 'CN'); await choose(map, 'OVERSEAS');
  await expect.poll(() => requests.length).toBe(9);
  const captured = await page.evaluate(async () => {
    let result: any;
    await window.runtime.withExportView(async view => {
      result = {choices:[...view.target.querySelectorAll('[data-chart-filter-selection]')].map(el => el.textContent),controls:view.target.querySelectorAll('[data-chart-filter] button').length};
    });
    return result;
  });
  expect(captured).toEqual({choices:['海外','中国区','欧洲（空结果）','海外'],controls:0});
  const geometry = await orders.evaluate(select => {
    const cell = select.closest('article')!.getBoundingClientRect();
    const control = select.getBoundingClientRect();
    return {inside:control.left>=cell.left && control.right<=cell.right,aboveTitle:control.bottom<=select.closest('article')!.querySelector('h3')!.getBoundingClientRect().top};
  });
  expect(geometry).toEqual({inside:true,aboveTitle:true});
  expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('chart-local-filters.png'),fullPage:true});
  await page.reload(); await expectSelected(orders, 'OVERSEAS'); await expectSelected(revenue, 'CN');
  await page.goto('/pages/chart-local-filter-page?orders-region=unknown&revenue-region=CN');
  await expectSelected(orders, 'CN'); await expectSelected(revenue, 'CN');
  await page.goto('/pages/chart-local-filter-page?orders-region=CN&orders-region=OVERSEAS');
  await expectSelected(orders, 'CN');
});

test('loading and failure retain controls; a late response cannot overwrite a newer selection', async ({page}) => {
  const orders = page.getByRole('group', {name:'订单对比筛选',exact:true});
  const cell = page.locator('[data-component="charts/orders"]');
  let mode: 'normal' | 'delay' | 'fail' = 'normal';
  let release: () => void = () => {};
  let started = false;
  await page.route('**/dsl/execute', async route => {
    const item = route.request().postDataJSON().dsl_list[0];
    if (item.output_metrics[0] !== 'chart_demo_orders' || item.filter.dims[0]?.dim_value_list[0] !== 'OVERSEAS') return route.continue();
    if (mode === 'fail') return route.abort('failed');
    if (mode !== 'delay') return route.continue();
    const response = await route.fetch(); started = true;
    await new Promise<void>(resolve => release = resolve);
    await route.fulfill({response}).catch(() => {}); // The cancelled consumer may already be gone.
  });
  await page.goto('/pages/chart-local-filter-page');
  await expect(cell.locator('.chart-semantics')).toContainText('国内一组');
  mode = 'delay'; await choose(orders, 'OVERSEAS');
  await expect.poll(() => started).toBe(true);
  await expect(orders.getByRole('button', {name:'中国区',exact:true})).toBeEnabled();
  await choose(orders, 'CN');
  await expect(cell.locator('.chart-semantics')).toContainText('国内一组');
  release();
  await expectSelected(orders, 'CN');
  await expect(cell.locator('.chart-semantics')).toContainText('国内一组');
  mode = 'fail'; await choose(orders, 'OVERSEAS');
  await expect.poll(() => page.evaluate(() => window.queryEvents.some((event: any) => event.type === 'data-error' && event.dataSourceId === 'orders-data'))).toBe(true);
  await expect(orders.getByRole('button', {name:'中国区',exact:true})).toBeEnabled(); await expectSelected(orders, 'OVERSEAS');
  await expect(cell.getByRole('heading', {name:'订单对比'})).toBeVisible();
  mode = 'normal'; await orders.locator('button[data-value=CN]').press('Space');
  await expect(cell.locator('.chart-semantics')).toContainText('国内一组');
});
