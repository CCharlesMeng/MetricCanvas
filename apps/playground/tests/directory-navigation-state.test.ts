import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageComponentTypes } from '../src/lib/page-directory';

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
    const { rememberDirectoryNavigationState } = await import('../src/lib/directory-navigation-state');
    const state = { query: '详情', layoutForm: 'report',
      component: pageComponentTypes[0]!.id, dataKind: 'inline', folder: 'capabilities/table', scrollY: 630 };
    rememberDirectoryNavigationState(state);
    vi.resetModules();
    const { readDirectoryNavigationState } = await import('../src/lib/directory-navigation-state');
    expect(readDirectoryNavigationState()).toEqual(state);
  });

  it('损坏记录、已删除选项和无效位置回退到可用默认值', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => '{broken' });
    const { normalizeDirectoryNavigationState, readDirectoryNavigationState } = await import('../src/lib/directory-navigation-state');
    const defaults = { query: '', layoutForm: 'all', component: 'all', dataKind: 'all', folder: 'all', scrollY: 0 };
    expect(readDirectoryNavigationState()).toEqual(defaults);
    expect(normalizeDirectoryNavigationState({ query: 42, layoutForm: 'removed',
      component: 'removed', dataKind: 'removed', scrollY: Infinity })).toEqual(defaults);
    expect(normalizeDirectoryNavigationState(null)).toEqual(defaults);
    expect(normalizeDirectoryNavigationState({ folder: '../outside' })).toEqual(defaults);
    expect(normalizeDirectoryNavigationState({ folder: 'business/dashboard/ioc/project' }).folder).toBe('business/dashboard/ioc/project');
    expect(normalizeDirectoryNavigationState({ folder: '业务/项目 示例' }).folder).toBe('业务/项目 示例');
  });

  it('存储不可用时仍在当前应用会话保留条件，重置状态不会复活旧条件', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); }
    });
    const { normalizeDirectoryNavigationState, readDirectoryNavigationState, rememberDirectoryNavigationState } = await import('../src/lib/directory-navigation-state');
    const state = { ...normalizeDirectoryNavigationState(null), query: '无匹配结果', scrollY: 520 };
    rememberDirectoryNavigationState(state);
    expect(readDirectoryNavigationState()).toEqual(state);
    const reset = normalizeDirectoryNavigationState(null);
    rememberDirectoryNavigationState(reset);
    expect(readDirectoryNavigationState()).toEqual(reset);
  });
});
