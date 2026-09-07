import { describe, expect, it } from 'vitest';
import type { NavigationTarget } from '@metriccanvas/page';
import { navigationHref, type FilterValues } from '../src';

const filters: FilterValues = new Map([
  ['region', {type:'dimension', dimension:'office-code', level:'office', values:['SH','北京&华南']}],
  ['period', {type:'timeRange', from:'2026-04-01', to:'2026-04-30'}],
  ['unused', {type:'search',query:'不得泄漏'}]
]);
const query: NonNullable<NavigationTarget['query']> = {
  code:{source:'row',field:'code'}, month:{source:'param',id:'month'},
  region:{source:'filter',id:'region'}, level:{source:'filter',id:'region',part:'level'},
  from:{source:'filter',id:'period',part:'from'}, to:{source:'filter',id:'period',part:'to'}
};
describe('普通 URL 导航', () => {
  it('三种显式来源，重复键，范围和层级，query 覆盖与 hash 保留', () => {
    const href = navigationHref({href:'../detail?tab=sales&code=old&code=older#history',query}, filters, new Map([['month','2026-04'],['secret','不携带']]), {code:'A&?/%# +中文'});
    const url = new URL(href,'https://host.example/app/list');
    expect(url.pathname).toBe('/detail');
    expect(url.hash).toBe('#history');
    expect([...url.searchParams.entries()]).toEqual([
      ['tab','sales'],['code','A&?/%# +中文'],['month','2026-04'],['region','SH'],['region','北京&华南'],['level','office'],['from','2026-04-01'],['to','2026-04-30']
    ]);
  });
  it('缺值省略，静态同名参数保留，0 与 false 不丢失', () => {
    expect(navigationHref({href:'/detail?code=static',query:{code:{source:'row',field:'missing'}, zero:{source:'row',field:'zero'}, flag:{source:'row',field:'flag'}}},new Map(),new Map(),{zero:0,flag:false})).toBe('/detail?code=static&zero=0&flag=false');
    for (const code of [null,'',NaN]) expect(navigationHref({href:'/detail',query:{code:{source:'row',field:'code'}}},new Map(),new Map(),{code})).toBe('/detail');
  });
  it('不解析 hash 路由内部 query', () => {
    expect(navigationHref({href:'/#/detail?tab=sales',query:{code:{source:'row',field:'code'}}},new Map(),new Map(),{code:'A001'})).toBe('/?code=A001#/detail?tab=sales');
  });
  it('绝对地址与文档基址解析，禁止可执行 scheme', () => {
    for (const href of ['https://example.com/detail','http://example.com','/detail','detail','?tab=x','#history']) expect(navigationHref({href},new Map(),new Map())).toBe(href);
    for (const href of ['javascript:alert(1)','data:text/html,x','file:///tmp/x',' java\nscript:x','\\evil']) expect(() => navigationHref({href},new Map(),new Map())).toThrow();
  });
});
