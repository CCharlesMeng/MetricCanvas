import { describe, expect, it } from 'vitest';
import { legacyPageHref } from '../src/lib/legacy-page-route';

describe('旧机会点分析地址兼容映射', () => {
  it('只将精确旧路径映射到唯一规范查看器', () => {
    expect(legacyPageHref('/operation-map/opportunity-page', '')).toBe(
      '/pages/ioc-opportunity-analysis'
    );
    expect(legacyPageHref('/operation-map/opportunity-page/', '')).toBeUndefined();
    expect(legacyPageHref('/operation-map/another-page', '')).toBeUndefined();
    expect(legacyPageHref('/pages/ioc-opportunity-analysis', '')).toBeUndefined();
  });

  it('原样保留查询串，不注入额外筛选或参数', () => {
    expect(legacyPageHref(
      '/operation-map/opportunity-page',
      '?demo=1&region=%E4%B8%AD%E5%9B%BD'
    )).toBe('/pages/ioc-opportunity-analysis?demo=1&region=%E4%B8%AD%E5%9B%BD');
  });
});
