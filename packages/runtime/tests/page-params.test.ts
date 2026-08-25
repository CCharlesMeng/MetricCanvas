import { describe, expect, it } from 'vitest';
import type { PageParamDeclaration } from '@metriccanvas/page';
import { createFilterState } from '../src/filter-state';
import {
  pageParamSearch,
  resolvePageParams,
  serializePageParam
} from '../src/page-params';

const param = (
  id: string,
  overrides: Partial<PageParamDeclaration> = {}
): PageParamDeclaration => ({ id, type: 'string', required: true, ...overrides });

describe('页面参数的 URL 解析', () => {
  it('按 p: 前缀取值，并按声明类型归一', () => {
    const { values, missing } = resolvePageParams(
      '?code=p%3AOPP202604001&count=p%3A42&flag=p%3Atrue',
      [param('code'), param('count', { type: 'number' }), param('flag', { type: 'boolean' })]
    );

    expect([...values]).toEqual([
      ['code', 'OPP202604001'],
      ['count', 42],
      ['flag', true]
    ]);
    expect(missing).toEqual([]);
  });

  it('缺前缀、类型不符与畸形转义都按未提供处理', () => {
    const declarations = [
      param('code'),
      param('count', { type: 'number' }),
      param('flag', { type: 'boolean' })
    ];
    const { values, missing } = resolvePageParams(
      'code=OPP202604001&count=p%3Aabc&flag=p%3Ayes',
      declarations
    );

    expect(values.size).toBe(0);
    expect(missing).toEqual(['code', 'count', 'flag']);
  });

  it('默认值兜底；可选参数缺失既不落值也不报缺失', () => {
    const { values, missing } = resolvePageParams('', [
      param('mtime', { default: '202604' }),
      param('level', { required: false })
    ]);

    expect([...values]).toEqual([['mtime', '202604']]);
    expect(missing).toEqual([]);
  });

  it('URL 里的取值覆盖默认值', () => {
    const { values } = resolvePageParams('mtime=p%3A202603', [
      param('mtime', { default: '202604' })
    ]);
    expect(values.get('mtime')).toBe('202603');
  });

  it('编解码往返保留分隔符与中文', () => {
    const values = new Map([['title', '云迁移 / 一期:A&B']]);
    const [parsed] = [
      resolvePageParams(pageParamSearch(values), [param('title')]).values.get('title')
    ];
    expect(parsed).toBe('云迁移 / 一期:A&B');
    expect(serializePageParam(true)).toBe('p:true');
  });
});

describe('页面参数与筛选状态互不干扰', () => {
  it('筛选状态不认识 p: 前缀，参数不会进筛选状态', () => {
    const state = createFilterState();
    state.fromURL('code=p%3AOPP202604001&region=d%3Aregion%3A%E5%8D%8E%E4%B8%9C');

    let current = new Map();
    state.subscribe((values) => {
      current = new Map(values);
    })();

    expect([...current.keys()]).toEqual(['region']);
  });

  it('筛选状态序列化不会带出参数键', () => {
    const state = createFilterState(
      new Map([['region', { type: 'dimension', dimension: 'region', values: ['华东'] }]])
    );
    expect(new URLSearchParams(state.toURL()).has('code')).toBe(false);
  });
});
