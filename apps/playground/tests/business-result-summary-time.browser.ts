import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

type Query = {
  output_dims: string[];
  output_metrics: string[];
  filter: { dims: {dim_name: string; dim_value_list: string[]; is_exclude?: boolean}[]; time: {
    period: string; start?: string; end?: string; is_aggregate?: boolean;
  } };
  order: Record<string, unknown>;
};

const discountMetric = '净商务折扣（原价）';
const closureMetric = '决策闭环任务总体闭环率(投标-商务-合同)';

function aggregateQueries(requests: Query[]): Query[] {
  return requests.filter(query => query.output_dims.length === 0 && query.filter.time?.is_aggregate === true);
}

function isDiscountAggregate(query: Query): boolean {
  return query.output_metrics.length === 1 && query.output_metrics[0]!.startsWith(discountMetric);
}

const chartSelector = '[data-component="net-discount-chart/net-discount-card"] .bar-chart .echart';
const chartRuntime = `/@fs${fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url))}`;

test('both tables share the backend aggregate and the chart shows a horizontal mean and yellow monthly line', async ({page}) => {
  const requests: Query[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/dsl/execute')) {
      requests.push(...(request.postDataJSON().dsl_list as Query[]));
    }
  });
  await page.goto('/pages/business-result-metrics?region=&mtime=month:2026-10');
  const group = page.locator('tr[data-pinned-top]');
  await expect(group).toHaveCount(2);
  for (const row of await group.all()) {
    await expect(row.getByRole('cell',{name:'合计',exact:true})).toBeVisible();
    await expect(row).not.toContainText('—');
  }
  const aggregate = aggregateQueries(requests);
  expect(aggregate).toHaveLength(5);
  const discount = aggregate.filter(isDiscountAggregate);
  expect(discount.map(query => query.output_metrics[0])).toEqual(expect.arrayContaining([discountMetric, discountMetric + '月变化']));
  for (const query of discount) expect(query.filter.dims).toEqual(expect.arrayContaining([
    expect.objectContaining({dim_name:'子业务类型编码',dim_value_list:['SUB_SERVICE_TYPE_PUBLIC_REGION']}),
    expect.objectContaining({dim_name:'云服务',is_exclude:true,dim_value_list:expect.arrayContaining(['ModelArts'])}),
  ]));
  expect(aggregate.filter(query => query.output_metrics.includes(closureMetric))
    .flatMap(query => query.filter.dims)).toEqual(expect.arrayContaining([
    expect.objectContaining({dim_name:'决策业务类型',dim_value_list:['商务']}),
    expect.objectContaining({dim_name:'决策业务类型',dim_value_list:['合同']})
  ]));
  for (const query of aggregate) {
    expect(query.filter.time).toEqual({period:'month',start:'2026-10',end:'2026-10',is_aggregate:true});
    if (query.output_metrics.includes(closureMetric)) expect(query.filter.dims.map(dim => dim.dim_name)).toEqual(['决策业务类型']);
    if (!query.output_metrics.includes(closureMetric) && !isDiscountAggregate(query)) expect(query.filter.dims).toEqual([]);
    expect(query.order).toEqual({});
  }

  await page.locator(chartSelector).scrollIntoViewIfNeeded();
  await expect(page.locator(chartSelector)).toHaveAttribute('_echarts_instance_',/.+/);
  await expect.poll(() => page.evaluate(async ({selector,chartRuntime}) => {
    const runtime = await import(chartRuntime);
    const chart = runtime.getInstanceByDom(document.querySelector(selector));
    const series = (chart?.getOption().series ?? []) as {name: string; type: string; symbol?: string; showSymbol?: boolean; showAllSymbol?: boolean; lineStyle?: {color: string}; data: (number | null)[]}[];
    const average = series.find(item => item.name === '净商务折扣（原价）均值');
    const seriesIndex = series.findIndex(item => item.name === '环比');
    const monthly = series[seriesIndex];
    return {
      averageType:average?.type,
      averageMarkers:average?.showSymbol,
      averageValues:[...new Set(average?.data)],
      monthlyColor:monthly?.lineStyle?.color ?? chart?.getVisual({seriesIndex},'color'),
      monthlyMarkers:{symbol:monthly?.symbol,show:monthly?.showSymbol,all:monthly?.showAllSymbol},
      monthlyPointColors:[...new Set(monthly?.data.map((_,dataIndex) => chart.getVisual({seriesIndex,dataIndex},'color')))]
    };
  }, {selector:chartSelector,chartRuntime})).toEqual({
    averageType:'line',averageMarkers:false,averageValues:[expect.any(Number)],
    monthlyColor:'#fec72a',monthlyMarkers:{symbol:'circle',show:true,all:true},monthlyPointColors:['#fec72a']
  });
});

test('refreshes just the discount totals for discount filters and all totals for the common filters', async ({page}) => {
  await page.setViewportSize({width:1600,height:850});
  const requests: Query[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/dsl/execute')) {
      requests.push(...(request.postDataJSON().dsl_list as Query[]));
    }
  });
  await page.goto('/pages/business-result-metrics?region=&mtime=month:2026-10');
  const header = page.locator('[data-ioc-header]');
  const pinned = page.locator('tr[data-pinned-top]');
  await expect(pinned).toHaveCount(2);
  const summaryCells = 'td:not([data-row-number])';
  const original = await pinned.first().locator(summaryCells).allTextContents();

  requests.length = 0;
  await header.getByRole('button',{name:'业务类型',exact:true}).click();
  await header.getByRole('tree').getByRole('button',{name:'华为公有云CORE',exact:true}).click();
  await expect.poll(() => aggregateQueries(requests).length).toBeGreaterThanOrEqual(2);
  for (const query of aggregateQueries(requests)) {
    expect(isDiscountAggregate(query)).toBe(true);
    expect(query.filter.dims).toContainEqual(expect.objectContaining({
      dim_name:'业务类型编码',dim_value_list:['SERVICE_TYPE_HUAWEI_PUBLIC_CLOUD_CORE']
    }));
  }
  await expect(pinned).toHaveCount(2);

  requests.length = 0;
  const service = '模拟云服务 16';
  await header.getByRole('button',{name:'云服务排除项',exact:true}).press('ArrowDown');
  const cloud = header.getByRole('dialog',{name:'云服务排除项候选'});
  await cloud.getByRole('textbox').fill(service);
  await cloud.getByRole('option',{name:service,exact:true}).click();
  await expect.poll(() => aggregateQueries(requests).length).toBeGreaterThanOrEqual(2);
  for (const query of aggregateQueries(requests)) {
    expect(isDiscountAggregate(query)).toBe(true);
    expect(query.filter.dims).toContainEqual(expect.objectContaining({
      dim_name:'云服务',is_exclude:true,dim_value_list:expect.arrayContaining([service])
    }));
  }
  await expect(pinned).toHaveCount(2);
  for (const row of await pinned.all()) {
    await expect(row.locator(summaryCells).nth(1)).not.toHaveText(original[1]!);
    expect((await row.locator(summaryCells).allTextContents()).slice(3)).toEqual(original.slice(3));
  }
  await page.keyboard.press('Escape');

  requests.length = 0;
  await header.getByRole('button',{name:'客户分类',exact:true}).press('ArrowDown');
  await header.getByRole('option',{name:'核心NA',exact:true}).click();
  await expect.poll(() => aggregateQueries(requests).length).toBeGreaterThanOrEqual(5);
  for (const query of aggregateQueries(requests)) {
    expect(query.filter.dims).toContainEqual(expect.objectContaining({dim_name:'客户级别',dim_value_list:['核心NA']}));
  }
  await expect(pinned).toHaveCount(2);

  requests.length = 0;
  await header.getByRole('button',{name:'区域',exact:true}).click();
  await header.getByRole('tree').getByRole('button',{name:'华东地区部',exact:true}).click();
  await expect.poll(() => aggregateQueries(requests).length).toBeGreaterThanOrEqual(5);
  for (const query of aggregateQueries(requests)) {
    expect(query.filter.dims).toEqual(expect.arrayContaining([
      expect.objectContaining({dim_name:'客户级别',dim_value_list:['核心NA']}),
      expect.objectContaining({dim_name:'地区部',dim_value_list:['CN-EAST']}),
    ]));
  }
  await expect(pinned).toHaveCount(1);
  await expect(pinned).not.toContainText('—');
});

for (const period of ['quarter:2026-Q3','year:2026']) {
  test(`the year-over-year line uses the monthly yellow in ${period}`,async ({page}) => {
    await page.goto(`/pages/business-result-metrics?region=&mtime=${period}`);
    await page.locator(chartSelector).scrollIntoViewIfNeeded();
    await expect(page.locator(chartSelector)).toHaveAttribute('_echarts_instance_',/.+/);
    await expect.poll(() => page.evaluate(async ({selector,chartRuntime}) => {
      const {getInstanceByDom} = await import(chartRuntime);
      const chart = getInstanceByDom(document.querySelector(selector));
      const seriesIndex = chart?.getOption().series.findIndex((entry:{name:string}) => entry.name === '同比') ?? -1;
      if (seriesIndex < 0) return;
      return chart.getVisual({seriesIndex},'color');
    },{selector:chartSelector,chartRuntime})).toBe('#fec72a');
  });
}

test('opening the header candidates before finalization waits for the applied period', async ({page}) => {
  const endpoint = '/synthetic-business-candidate-clock';
  const nameField = '模拟报表名', dateField = '模拟定稿日';
  await page.addInitScript(({endpoint,nameField,dateField}) => Object.assign(window,{__METRICCANVAS__:{
    dqeEndpoint:endpoint,pageMetadataBaseUrl:'/pages',authToken:'synthetic',operatorId:'synthetic',workspaceId:'synthetic',
    finalizationSource:{nameField,dateField,body:{dsl_list:[{output_dims:[nameField,dateField],output_metrics:[],filter:{dims:[],metrics:[]}}]}}
  }}), {endpoint,nameField,dateField});
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const candidate: Query[] = [];
  let finalizationRequested = false;
  const regions: Record<string,string> = {'geo-pc-code':'R99','region-dept-code':'华东地区部','rep-office-code':'上海代表处'};
  await page.route(`**${endpoint}`, async route => {
    const items = route.request().postDataJSON().dsl_list as Query[];
    if (items.some(item => item.output_dims.includes(nameField))) {
      finalizationRequested = true;
      await delayed;
    }
    const results = items.map(item => {
      const field = item.output_dims[0];
      let data: Record<string,string|number>[] = [];
      if (field === nameField) data = [{[nameField]:'业务结果指标',[dateField]:'2026-10-15'}];
      else if (field && regions[field]) data = [{[field]:regions[field]}];
      else if (field === '云服务') {
        candidate.push(item);
        data = [{云服务:'模拟服务 A',净付费金额:100}];
      }
      return {code:'SUCCESS',data,total_count:data.length};
    });
    await route.fulfill({json:{retCode:'CBC.0000',results}});
  });
  try {
    await page.goto('/pages/business-result-metrics?region=R99&region.level=geo');
    await expect.poll(() => finalizationRequested).toBe(true);
    await page.getByRole('button',{name:'云服务排除项',exact:true}).press('ArrowDown');
    const menu = page.getByRole('dialog',{name:'云服务排除项候选'});
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('status')).toHaveCount(0);
    await expect(menu.getByRole('alert')).toHaveCount(0);
    expect(candidate).toHaveLength(0);
    release();
    await expect(menu.getByRole('option',{name:'模拟服务 A',exact:true})).toBeVisible();
    expect(candidate.map(item => item.filter.time)).toEqual([
      {period:'month',start:'2026-10',end:'2026-10',is_aggregate:false}
    ]);
    expect(candidate[0].filter.dims).toContainEqual({dim_name:'geo_pc_code',dim_value_list:['R99']});
  } finally { release(); }
});

test('an unrestricted Region preloads the first 20 cloud services and waits for scrolling to load more',async ({page}) => {
  const pages: Query[] = [];
  let release!: () => void;
  const more = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/dsl/execute',async route => {
    const items = route.request().postDataJSON().dsl_list as Query[];
    const results = await Promise.all(items.map(async item => {
      if (item.output_dims[0] !== '云服务') return {code:'SUCCESS',data:[],total_count:0};
      pages.push(item);
      const offset = Number(item.order.offset);
      if (offset > 0) await more;
      const data = Array.from({length:Math.min(Number(item.order.limit),24-offset)},(_,index) => ({云服务:`模拟服务 ${offset+index+1}`,净付费金额:100}));
      return {code:'SUCCESS',data,total_count:24};
    }));
    await route.fulfill({json:{retCode:'CBC.0000',results}});
  });
  try {
    await page.goto('/pages/business-result-metrics?region=&mtime=month:2026-10');
    const trigger = page.getByRole('button',{name:'云服务排除项',exact:true});
    await expect(trigger).toHaveAttribute('aria-expanded','false');
    await expect.poll(() => pages.map(item => item.order.offset)).toEqual([0]);
    expect(pages[0].order.limit).toBe(20);
    expect(pages[0].filter).toMatchObject({dims:[],time:{period:'month',start:'2026-10',end:'2026-10'}});
    await trigger.press('ArrowDown');
    const menu = page.getByRole('dialog',{name:'云服务排除项候选'});
    const list = menu.getByRole('listbox');
    await expect(list.getByRole('option',{name:/^模拟服务 /})).toHaveCount(20);
    await expect(list.getByRole('option',{name:'ModelArts',exact:true,selected:true})).toBeVisible();
    await expect(menu.getByRole('status')).toHaveCount(0);
    expect(pages.map(item => item.order.offset)).toEqual([0]);
    await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => pages.map(item => item.order.offset)).toEqual([0,20]);
    await expect(list.getByRole('status')).toHaveText('正在加载更多');
    await expect(list.getByRole('status')).toHaveCSS('clip-path','inset(50%)');
    release();
    await expect(list.getByRole('option',{name:'模拟服务 24',exact:true})).toBeVisible();
    await expect(menu.getByRole('status')).toHaveCount(0);
  } finally { release(); }
});

test('the initial Playground Region loads another cloud-service page when the user wheels to the bottom',async ({page}) => {
  const offsets:number[] = [];
  page.on('request', request => {
    if (request.method() !== 'POST' || !request.url().endsWith('/dsl/execute')) return;
    const items = request.postDataJSON().dsl_list as Query[];
    for (const item of items) {
      if (item.output_dims[0] === '云服务') offsets.push(Number(item.order.offset));
    }
  });
  await page.goto('/pages/business-result-metrics?mtime=month:2026-10');
  const trigger = page.getByRole('button',{name:'云服务排除项',exact:true});
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await expect.poll(() => offsets).toEqual([0]);
  await trigger.press('ArrowDown');
  const menu = page.getByRole('dialog',{name:'云服务排除项候选'});
  const list = menu.getByRole('listbox');
  const options = list.getByRole('option',{name:/^模拟云服务 /});
  await expect(options).toHaveCount(20);
  await expect(menu.getByText('暂无可添加的候选项')).toHaveCount(0);
  await list.hover();
  await page.mouse.wheel(0,3500);
  await expect.poll(() => offsets).toEqual([0,20]);
  await expect(options).toHaveCount(35);
});

test('云服务排除项关闭 URL 同步，默认值和手动排除继续下推', async ({page}) => {
  const requests: Query[] = [];
  const service = '模拟新增排除项';
  const legacy = '旧链接排除项';
  await page.setViewportSize({width: 1600, height: 850});
  await page.route('**/dsl/execute', async route => {
    const items: Query[] = route.request().postDataJSON().dsl_list;
    requests.push(...items);
    const results = items.map(item => item.output_dims[0] === '云服务'
      ? {code: 'SUCCESS', data: [{云服务: service, 净付费金额: 100}], total_count: 1}
      : {code: 'SUCCESS', data: [], total_count: 0});
    await route.fulfill({json: {retCode: 'CBC.0000', results}});
  });

  const period = 'month:2026-10';
  const search = new URLSearchParams([['region', ''], ['mtime', period], ['cloud-service', ''], ['cloud-service', legacy]]);
  await page.goto(`/pages/business-result-metrics?${search}`);
  await expect(page).toHaveURL(url => !url.searchParams.has('cloud-service') && url.searchParams.get('mtime') === period);

  const trigger = page.getByRole('button', {name: '云服务排除项', exact: true});
  const menu = page.getByRole('dialog', {name: '云服务排除项候选'});
  const defaultChoice = menu.getByRole('option', {name: 'ModelArts', exact: true, selected: true});
  const newChoice = menu.getByRole('option', {name: service, exact: true});
  await trigger.press('ArrowDown');
  await expect(defaultChoice).toBeVisible();
  await expect(menu.getByRole('option', {name: legacy, exact: true})).toHaveCount(0);
  await expect(newChoice).toHaveAttribute('aria-selected', 'false');

  const discountExclusions = () => requests.filter(item => item.output_metrics.includes('净商务折扣（原价）'))
    .flatMap(item => item.filter.dims.filter(predicate => predicate.dim_name === '云服务' && predicate.is_exclude === true))
    .flatMap(predicate => predicate.dim_value_list);
  await expect.poll(discountExclusions).toContain('ModelArts');
  expect(discountExclusions()).not.toContain(legacy);
  await newChoice.click();
  await expect.poll(discountExclusions).toContain(service);
  await expect(page).toHaveURL(url => !url.searchParams.has('cloud-service') && url.searchParams.get('mtime') === period);

  await page.reload();
  await trigger.press('ArrowDown');
  await expect(defaultChoice).toBeVisible();
  await expect(newChoice).toHaveAttribute('aria-selected', 'false');
});
