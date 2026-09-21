import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const navigationPage = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/url-navigation-page.json', import.meta.url), 'utf8'));

test('无导航适配的 HTML 宿主完成 IOC 概览→清单→详情及浏览器返回', async ({page}) => {
  await page.goto('/pages/ioc-project-overview');
  const list = page.locator('a.link-cell[href*="ioc-opportunity-list"]').first();
  await expect(list).toBeVisible();
  await list.click();
  await expect(page).toHaveURL(/\/pages\/ioc-opportunity-list\?/);
  expect(new URL(page.url()).searchParams.get('region.level')).toBe('office');
  const detail = page.locator('a.link-cell[href*="ioc-project-detail"]').first();
  await expect(detail).toBeVisible();
  const target = await detail.getAttribute('href');
  expect(new URL(target!,page.url()).searchParams.get('opportunity-code')).toBe('OPP202604001');
  await detail.click();
  await expect(page).toHaveURL(/\/pages\/ioc-project-detail\?/);
  await expect(page.locator('.runtime-view')).toContainText('XX 云迁移项目');
  await page.goBack();
  await expect(page.locator('a.link-cell[href*="ioc-project-detail"]').first()).toBeVisible();
  await page.goForward();
  await expect(page.locator('.runtime-view')).toContainText('XX 云迁移项目');
});

// 层级维度筛选绑定逐级下推谓词字段(ADR-0084)。同一个区域筛选器在三层各
// 命中不同的 DQE 字段,夹具里三层的行数互不相同;恒定字段或忽略 level 的
// 实现会让三次断言塌到同一个数字。
test('层级区域筛选按当前层级选谓词字段，三层各自命中', async ({ page }) => {
  const rows = page.locator('[data-component="list/opportunity-table"] tbody tr');
  // 每页 5 行，geo 的 9 行因此只显示 5；三个数字仍互不相同。
  for (const [level, code, expected] of [
    ['geo', 'R99', 5],
    ['region-dept', 'CN-EAST', 3],
    ['office', 'SH-01', 1]
  ] as const) {
    await page.goto(`/pages/ioc-opportunity-list?region.level=${level}&region=${code}`);
    await expect(rows).toHaveCount(expected);
  }
});

// 页内详情浮层（ADR-0087）：动作闭集此前只有 writeFilter 与 navigate，
// 详情只能靠跳页。丢单表的丢单原因在页内看才合理——丢掉的项目往往没有
// 项目详情页可跳。
test('丢单表点击在页内打开详情抽屉，不离开当前页', async ({ page }) => {
  await page.goto('/pages/ioc-project-overview');
  const host = page.locator('[data-metriccanvas-runtime]');
  const panel = host.locator('[data-detail-panel]');
  await expect(panel).toHaveCount(0);

  await host.getByRole('tab', { name: '丢单项目' }).click();
  const cell = host.locator('a.link-cell').first();
  await expect(cell).toBeVisible();
  const url = page.url();
  await cell.click();

  await expect(panel).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(host.locator('[data-detail-title]')).toHaveText('海外节点扩容');
  await expect(host.locator('[data-detail-item]')).toHaveCount(7);
  await expect(host.locator('[data-detail-item]').last()).toContainText('价格竞争力不足');
  await expect(host.locator('[data-detail-backdrop], .detail-backdrop')).toHaveAttribute(
    'data-detail-surface',
    'drawer'
  );

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

// 查询分页此前与排序、表头筛选互斥（ADR-0086）。分页下本地排序只能排到
// 当前页，所以排序必须由上游执行——按金额降序后第一页第一行必须是全表
// 最大值，而不是首页那 5 行里的最大值。
test('查询分页与服务端排序共存，排序作用于全表而不是当前页', async ({ page }) => {
  await page.goto('/pages/ioc-opportunity-list');
  const table = page.locator('[data-component="list/opportunity-table"]');
  const firstCode = table.locator('tbody tr').first().locator('td').first();
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(firstCode).toHaveText('OPP202604001');

  const amountHeader = table.locator('th[data-column-field="bidding-amount"] .sort-toggle');
  await amountHeader.click();
  // 升序最小值在第二页，本地排序取不到它。
  await expect(firstCode).toHaveText('OPP202604010');
  await amountHeader.click();
  await expect(firstCode).toHaveText('OPP202604004');
  await expect(table.locator('tbody tr')).toHaveCount(5);
});

// timePoint / boolean / numberRange 此前协议上无处可绑，页面上拉了不动数
// (ADR-0085)。三类谓词形状各不相同，各用一个能区分的取值验。
test('时间点、布尔与数值区间筛选各自下推到查询', async ({ page }) => {
  const table = page.locator('[data-component="list/opportunity-table"]');
  const rows = table.locator('tbody tr');
  // 每页 5 行，所以用页码数读总量：10 行两页、5 行一页、0 行没有行。
  const pages = table.locator('.page-button');
  // 数据列是 202604，筛选值是 2026-04：格式声明错了就一行都取不到。
  await page.goto('/pages/ioc-opportunity-list?mtime=2026-04');
  await expect(pages).toHaveCount(2);
  await page.goto('/pages/ioc-opportunity-list?mtime=2026-05');
  await expect(rows).toHaveCount(0);
  // 勾上才加条件；不勾等于无条件，不是筛「为假」。
  await page.goto('/pages/ioc-opportunity-list?key-office=true');
  await expect(rows).toHaveCount(5);
  // 只剩一页时整个页码器不渲染；取反的实现会得到另外 5 行、页码器同样消失，
  // 所以下一条断言的是「不勾等于全都看」。
  await expect(pages).toHaveCount(0);
  await page.goto('/pages/ioc-opportunity-list');
  await expect(pages).toHaveCount(2);
  // 两端各自可缺席。
  await page.goto('/pages/ioc-opportunity-list?bidding-amount.from=50000000');
  await expect(rows).toHaveCount(4);
  await page.goto(
    '/pages/ioc-opportunity-list?bidding-amount.from=15000000&bidding-amount.to=54000000'
  );
  await expect(rows).toHaveCount(4);
});

// 级联的「按上游收窄」此前整条空转：清空下游、重拉候选都做了，但适配器把
// constraints 丢了，拉回来的仍是全量。这里选一级行业后数下游候选项。
test('云行业选定后云子行业候选按上游收窄', async ({ page }) => {
  await page.goto('/pages/ioc-opportunity-list');
  const toolbar = page.locator('header[data-dashboard-toolbar]');
  await expect(toolbar).toBeVisible();
  await toolbar.locator('[data-dashboard-filter-overflow] > summary').click();
  const level2 = page.locator('[data-filter-id="industry-l2"]');
  const level1 = page.locator('[data-filter-id="industry-l1"]');
  const level2Options = level2.locator('.menu .option');

  await level2.locator('summary').click();
  await expect(level2Options).toHaveCount(10);
  await level2.locator('summary').click();

  await level1.locator('summary').click();
  await level1.locator('.menu .option', { hasText: '零售' }).locator('input').check();
  await level1.locator('summary').click();

  await level2.locator('summary').click();
  await expect(level2Options).toHaveCount(2);
  await expect(level2Options).toHaveText(['零售-连锁', '零售-外贸']);
});

test('相对/绝对链接、三种绑定、复制地址、新标签和缺值都遵循原生 anchor', async ({page, context}) => {
  await page.goto('/pages/ioc-project-overview');
  await expect(page.locator('.runtime-view')).toBeVisible();
  await page.evaluate(() => {
    window.runtime.update({
      document:{schemaVersion:'6.0',id:'links',params:[{id:'month',type:'string',required:true}],filters:[{id:'region',type:'dimension',dimension:'region',default:['SH','BJ']}],dataSources:{},sections:[{id:'main',components:[{id:'links',type:'text',layout:{span:12},props:{links:[
        {label:'相对',href:'ioc-project-detail?tab=sales#history',query:{mtime:{source:'param',id:'month'},region:{source:'filter',id:'region'}}},
        {label:'绝对',href:location.origin+'/pages/ioc-opportunity-list?tab=one#list'},
        {label:'缺值',href:'/pages/ioc-project-detail',query:{region:{source:'filter',id:'empty'}}}
      ]}}]}]},initialSearch:'month=2026-04'
    });
  });
  // 源引用必须合法；缺值与未声明是两件事。修正声明后测试未选择值。
  await expect(page.locator('.runtime-view')).toContainText('未声明的筛选器:empty');
  await page.evaluate(() => {
    window.runtime.update({document:{schemaVersion:'6.0',id:'links',params:[{id:'month',type:'string',required:true}],filters:[{id:'region',type:'dimension',dimension:'region',default:['SH','BJ']},{id:'empty',type:'dimension',dimension:'region'}],dataSources:{},sections:[{id:'main',components:[{id:'links',type:'text',layout:{span:12},props:{links:[
      {label:'相对',href:'ioc-project-detail?tab=sales#history',query:{mtime:{source:'param',id:'month'},region:{source:'filter',id:'region'}}},
      {label:'绝对',href:location.origin+'/pages/ioc-opportunity-list?tab=one#list'},
      {label:'缺值',href:'/pages/ioc-project-detail',query:{region:{source:'filter',id:'empty'}}}
    ]}}]}]},initialSearch:'month=2026-04'});
  });
  const relative=page.getByRole('link',{name:'相对 →',exact:true});
  await expect(relative).toHaveAttribute('href','ioc-project-detail?tab=sales&mtime=2026-04&region=SH&region=BJ#history');
  expect(await relative.evaluate(a=>(a as HTMLAnchorElement).href)).toBe('http://127.0.0.1:4175/pages/ioc-project-detail?tab=sales&mtime=2026-04&region=SH&region=BJ#history');
  await expect(page.getByRole('link',{name:'缺值 →',exact:true})).toHaveAttribute('href','/pages/ioc-project-detail');
  const popupPromise=context.waitForEvent('page');
  await relative.click({modifiers:['ControlOrMeta']});
  const popup=await popupPromise;
  await popup.waitForURL(/ioc-project-detail/);
  expect(new URL(popup.url()).searchParams.getAll('region')).toEqual(['SH','BJ']);
  await popup.close();
  await page.getByRole('link',{name:'绝对 →',exact:true}).click();
  await expect(page).toHaveURL(/\/pages\/ioc-opportunity-list\?tab=one#list/);
});

test('图表直接点击执行默认导航，不依赖宿主回调', async ({page}) => {
  await page.goto('/pages/ioc-project-overview');
  await expect(page.locator('.runtime-view')).toBeVisible();
  await page.evaluate(() => window.runtime.update({document:{schemaVersion:'6.0',id:'chart-link',dataSources:{values:{fields:{category:{type:'string',role:'dimension'},amount:{type:'number',role:'measure'}},source:{type:'inline',rows:[{category:'A001',amount:10}]}}},sections:[{id:'main',components:[{id:'chart',type:'barChart',layout:{span:12},data:{main:'values'},props:{categoryField:'category',series:[{field:'amount',label:'金额'}],actions:[{on:'click',navigate:{href:'/pages/ioc-project-detail',query:{'opportunity-code':{source:'row',field:'category'}}}}]}}]}]}}));
  const chart=page.locator('canvas').first();
  await expect(chart).toBeVisible();
  const box=await chart.boundingBox();
  await chart.click({position:{x:box!.width/2,y:box!.height/2}});
  await expect(page).toHaveURL(/opportunity-code=A001/);
});

test('宿主可选接管，同文档更换初始参数重新初始化，省略接管恢复默认链接', async ({ page }) => {
  await page.goto('/pages/ioc-project-overview');
  await expect(page.locator('.runtime-view')).toBeVisible();
  await page.evaluate(() => {
    window.pageDocument = { schemaVersion: '6.0', id: 'same-page', params: [{ id: 'code', type: 'string', required: true }], dataSources: {}, sections: [{ id: 'main', components: [{ id: 'link', type: 'text', layout: { span: 12 }, props: { body: { param: 'code' }, links: [{ label: '更换参数', href: '?code=B#next', query: { previous: { source: 'param', id: 'code' } } }] } }] }] };
    window.runtime.update({ document: window.pageDocument, initialSearch: 'code=A', navigation: {
      navigate(target) {
        const url = new URL(target.href, document.baseURI);
        history.pushState(null, '', url);
        // 真正的路由变化传入完整输入；省略 navigation 表示下一次回到默认行为。
        window.runtime.update({ document: window.pageDocument, initialSearch: url.search });
        return true;
      }
    } });
  });
  const link = page.getByRole('link', { name: '更换参数 →' });
  await expect(link).toHaveAttribute('href', '?code=B&previous=A#next');
  await page.evaluate(() => document.body.dataset.sameDocument = 'yes');
  await link.click();
  await expect(page).toHaveURL(/code=B&previous=A#next$/);
  await expect(page.locator('body')).toHaveAttribute('data-same-document', 'yes');
  await expect(link).toHaveAttribute('href', '?code=B&previous=B#next');
  await page.evaluate(() => window.runtime.update({ document: window.pageDocument, initialSearch: 'code=C' }));
  await expect(link).toHaveAttribute('href', '?code=B&previous=C#next');
});


test('指标值链接从实际点击的数据槽取行参数', async ({ page }) => {
  await page.goto('/pages/ioc-project-overview');
  await expect(page.locator('.runtime-view')).toBeVisible();
  await page.evaluate(document => window.runtime.update({ document }), navigationPage);
  const link = page.locator('[data-component="main/compare-link"] [data-metric-row-link]');
  await expect(link).toHaveAttribute('href', /code=A001/);
  expect(await link.evaluate(a => new URL((a as HTMLAnchorElement).href).searchParams.get('code'))).toBe('A001');
});
