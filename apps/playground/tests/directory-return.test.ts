import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('查找目录回退', () => {
  it('在页面详情外保存实际目录和搜索，不接收外部或业务页面作为目录', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) });
    const module = await import('../src/lib/directory-return');
    const href = '/catalog/components/table?q=子表';
    module.rememberDirectoryHref(href);
    expect(module.readDirectoryHref()).toBe(href);
    for (const invalid of ['https://example.com/', '//example.com/', '/pages/table-row-number', '/catalog/components/table/extra']) {
      module.rememberDirectoryHref(invalid);
      expect(module.readDirectoryHref()).toBe(href);
    }
  });

  it('会话存储不可用时保留本次目录；损坏的保存地址不覆盖内存', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    const module = await import('../src/lib/directory-return');
    module.rememberDirectoryHref('/files?scope=business');
    expect(module.readDirectoryHref()).toBe('/files?scope=business');
    vi.stubGlobal('sessionStorage', { getItem: () => '//example.com/' });
    expect(module.readDirectoryHref()).toBe('/files?scope=business');
  });
});
