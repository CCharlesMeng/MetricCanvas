import {readFileSync,existsSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage,documentUsesRuntimeBackToolbar,type Page} from '@metriccanvas/page/internal';
import {resolvePageHeader,pageFiltersReadOnly} from '../src/ioc-header/page-header';

function load(name:string):Page {
  const parsed=parsePage(JSON.parse(readFileSync(new URL(`../../../page/fixtures/contract-valid/${name}.json`,import.meta.url),'utf8')));
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  return parsed.page;
}
it('legacy Dashboard metadata resolves to the only header implementation',()=>{
  const page=load('dashboard-period-filter'),header=resolvePageHeader(page,page.filters??[]);
  expect(header.model).toMatchObject({layout:'inline',legacyBack:true,title:'期间筛选验收'});
  expect(header.primary.map(filter=>filter.id)).toEqual(['period-filter']);
  expect(existsSync(new URL('../src/dashboard/DashboardToolbar.svelte',import.meta.url))).toBe(false);
});
it('a hidden legacy header leaves remaining page filters in content',()=>{
  const page=load('dashboard-period-filter');page.dashboardToolbar='hidden';
  const header=resolvePageHeader(page,page.filters??[]);
  expect(header.model).toBeUndefined();expect(header.content.map(filter=>filter.id)).toEqual(['period-filter']);
});
it('explicit identity owns only its ordered filters and does not duplicate unclaimed filters',()=>{
  const page=load('filters-page');delete page.dashboardToolbar;
  page.iocHeader={identity:{title:'统一页头'},filterIds:['chosen'],readOnly:true,note:'只读说明',presentation:{layout:'inline',collapse:'overflow'}};
  const declarations=[{id:'unclaimed',type:'boolean' as const},{id:'chosen',type:'boolean' as const}];
  const header=resolvePageHeader(page,declarations);
  expect(header.model).toMatchObject({title:'统一页头',layout:'inline'});expect(header.model?.legacyBack).toBeUndefined();
  expect(header.primary.map(filter=>filter.id)).toEqual(['chosen']);expect(header.content.map(filter=>filter.id)).toEqual(['unclaimed']);
  expect(header).toMatchObject({readOnly:true,note:'只读说明'});expect(pageFiltersReadOnly(page)).toBe(true);
});
it('legacy readonly and note remain compatible while explicit header controls return ownership',()=>{
  const page=load('dashboard-period-filter');page.dashboardToolbar={variant:'compact',readOnly:true,note:'兼容只读'};
  expect(resolvePageHeader(page,page.filters??[])).toMatchObject({model:{density:'compact',layout:'inline'},readOnly:true,note:'兼容只读'});
  page.iocHeader={identity:{title:'无返回'}};
  expect(documentUsesRuntimeBackToolbar(page)).toBe(false);page.iocHeader.back=true;expect(documentUsesRuntimeBackToolbar(page)).toBe(true);
});
