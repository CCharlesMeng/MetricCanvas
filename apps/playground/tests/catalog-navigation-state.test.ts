import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogCapabilities } from '../src/lib/page-catalog';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('目录导航状态', () => {
  it('在会话中完整保存搜索、组合筛选与位置，独立模块重新加载仍能读取', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    });
    const { rememberCatalogNavigationState } = await import('../src/lib/catalog-navigation-state');
    const state = { query: '详情', category: 'features', layoutForm: 'report',
      capability: catalogCapabilities[0]!.id, runtime: 'none', scrollY: 630 };
    rememberCatalogNavigationState(state);
    vi.resetModules();
    const { readCatalogNavigationState } = await import('../src/lib/catalog-navigation-state');
    expect(readCatalogNavigationState()).toEqual(state);
  });

  it('损坏记录、已删除选项和无效位置回退到可用默认值', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => '{broken' });
    const { normalizeCatalogNavigationState, readCatalogNavigationState } = await import('../src/lib/catalog-navigation-state');
    const defaults = { query: '', category: 'all', layoutForm: 'all', capability: 'all', runtime: 'all', scrollY: 0 };
    expect(readCatalogNavigationState()).toEqual(defaults);
    expect(normalizeCatalogNavigationState({ query: 42, category: 'removed', layoutForm: 'removed',
      capability: 'removed', runtime: 'removed', scrollY: Infinity })).toEqual(defaults);
    expect(normalizeCatalogNavigationState(null)).toEqual(defaults);
  });

  it('存储不可用时仍在当前应用会话保留条件，重置状态不会复活旧条件', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); }
    });
    const { normalizeCatalogNavigationState, readCatalogNavigationState, rememberCatalogNavigationState } = await import('../src/lib/catalog-navigation-state');
    const state = { ...normalizeCatalogNavigationState(null), query: '无匹配结果', scrollY: 520 };
    rememberCatalogNavigationState(state);
    expect(readCatalogNavigationState()).toEqual(state);
    const reset = normalizeCatalogNavigationState(null);
    rememberCatalogNavigationState(reset);
    expect(readCatalogNavigationState()).toEqual(reset);
  });
});
