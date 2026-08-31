import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPageReturns,
  pageHref,
  pageReturnHref,
  pageReturnOf,
  rememberPageReturn
} from '../src/lib/page-return';

afterEach(() => {
  clearPageReturns();
});

describe('Canvas 回跳记录', () => {
  it('记下来源页,深链接没有来源', () => {
    expect(pageReturnOf('detail')).toBeUndefined();
    rememberPageReturn('detail', { pageId: 'list', search: 'keyword=s%3Acloud' });
    expect(pageReturnOf('detail')).toEqual({
      pageId: 'list',
      search: 'keyword=s%3Acloud'
    });
  });

  it('没有来源页时不写,href 保留查询串', () => {
    rememberPageReturn('detail', {});
    expect(pageReturnOf('detail')).toBeUndefined();
    expect(pageHref('list', 'd:region:east')).toBe('/pages/list?d:region:east');
    expect(pageReturnHref('detail')).toBeUndefined();
  });

  it('只有真实来源记录才产生返回 href', () => {
    rememberPageReturn('detail', { pageId: 'list', search: 'keyword=s%3Acloud' });
    expect(pageReturnHref('detail')).toBe('/pages/list?keyword=s%3Acloud');
  });
});
