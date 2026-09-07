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
