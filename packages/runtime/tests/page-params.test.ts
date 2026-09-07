import { describe, expect, it } from 'vitest';
import { resolvePageParams, pageParamSearch, parseFilterSearch } from '../src';
const declarations = [{id:'code',type:'string',required:true},{id:'count',type:'number',required:false},{id:'flag',type:'boolean',required:false}] as const;
describe('普通页面参数', () => {
  it('按声明解析数值布尔，特殊字符只解码一次', () => {
    const values = new Map<string,string|number|boolean>([['code','A&?/% +中文'],['count',0],['flag',false]]);
    expect(resolvePageParams(pageParamSearch(values), declarations).values).toEqual(values);
  });
  it('缺值由接收方处理；声明默认值继续有效', () => {
    expect(resolvePageParams('',declarations).missing).toEqual(['code']);
    expect(resolvePageParams('',[{id:'code',type:'string',required:true,default:'demo'}]).values.get('code')).toBe('demo');
    expect(resolvePageParams('count=NaN&flag=yes&code=',declarations).values.size).toBe(0);
  });
  it('p: 不再是编码前缀，普通字符串保持原义', () => {
    expect(resolvePageParams('code=p%3AABC',declarations).values.get('code')).toBe('p:ABC');
    expect(resolvePageParams('code=first&code=second',declarations).values.get('code')).toBe('first');
  });
  it('筛选只消费自身声明，与页面参数隔离', () => {
    expect(parseFilterSearch('code=A001&region=SH',[{id:'region',type:'dimension',dimension:'region'}])).toEqual(new Map([['region',{type:'dimension',dimension:'region',values:['SH']}]]));
  });
});
