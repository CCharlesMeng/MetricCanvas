import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import catalog from '../page-catalog.json';
import { filterPageCatalog, organizePageCatalog } from '../src/lib/page-catalog';
import { catalogPageEntry } from '../src/lib/page-catalog-entry';

describe('页面试验场目录', () => {
  it('现有样例都明确归类且仅出现一次，目录只展示存在页面', () => {
    const ids = readdirSync(fileURLToPath(new URL('../../../pages', import.meta.url)))
      .filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5));
    expect(catalog.pages.map((page) => page.id).filter((id) => ids.includes(id)).sort()).toEqual(ids.sort());
    expect(new Set(catalog.pages.map((page) => page.id)).size).toBe(catalog.pages.length);
    const groups = organizePageCatalog(ids.map((id) => ({ id, title: id, layoutForm: 'report' })));
    expect(groups.flatMap((group) => group.pages).map((page) => page.id).sort()).toEqual(ids);
  });

  it('新页面自动进入待归类，配置中已删除的页面不出现', () => {
    const groups = organizePageCatalog([{ id: 'new-example', title: '新样例', layoutForm: 'dashboard' }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.category).toBe('unclassified');
    expect(groups[0]?.pages.map((page) => page.id)).toEqual(['new-example']);
  });

  it('保留文档标题，搜索兼容 ID、标签、说明和分类组合', () => {
    const groups = organizePageCatalog(catalog.pages.map((page) => ({
      id: page.id, title: `文档标题 ${page.id}`, description: '技术说明', layoutForm: 'report'
    })));
    expect(groups[0]?.pages[0]?.title).toBe(`文档标题 ${catalog.pages[0]?.id}`);
    expect(filterPageCatalog(groups, 'EXCEL 导出', 'features').flatMap((group) => group.pages)).toHaveLength(1);
    expect(filterPageCatalog(groups, 'EXCEL', 'business')).toEqual([]);
    expect(filterPageCatalog(groups, 'flow-analysis 参数').flatMap((group) => group.pages)).toHaveLength(1);
    expect(filterPageCatalog(groups, '技术说明').flatMap((group) => group.pages)).toHaveLength(catalog.pages.length);
  });

  it('布局形态遵循文档声明和协议默认值，不依据页面标题', () => {
    expect(catalogPageEntry({ layout: 'report', meta: { title: '看板演示' } }, 'example').layoutForm).toBe('report');
    expect(catalogPageEntry({ layout: 'dashboard' }, 'example').layoutForm).toBe('dashboard');
    expect(catalogPageEntry({ layoutForm: 'dashboard' }, 'example').layoutForm).toBe('dashboard');
    expect(catalogPageEntry({ layout: 'report', layoutForm: 'dashboard' }, 'example').layoutForm).toBe('report');
    expect(catalogPageEntry({}, 'example').layoutForm).toBe('report');
  });

  it('真实页面按布局形态完整分离，形态与用途、关键词可组合筛选', () => {
    const directory = new URL('../../../pages/', import.meta.url);
    const pages = readdirSync(fileURLToPath(directory)).filter((file) => file.endsWith('.json'))
      .map((file) => catalogPageEntry(JSON.parse(readFileSync(new URL(file, directory), 'utf8')), file.slice(0, -5)));
    const groups = organizePageCatalog(pages);
    const dashboard = filterPageCatalog(groups, '', 'all', 'dashboard').flatMap((group) => group.pages);
    const report = filterPageCatalog(groups, '', 'all', 'report').flatMap((group) => group.pages);
    expect(dashboard.length).toBeGreaterThan(0);
    expect(report.length).toBeGreaterThan(0);
    expect([...dashboard, ...report].map((entry) => entry.id).sort()).toEqual(pages.map((entry) => entry.id).sort());
    expect(dashboard.every((entry) => entry.layoutForm === 'dashboard')).toBe(true);
    expect(report.every((entry) => entry.layoutForm === 'report')).toBe(true);
    expect(filterPageCatalog(groups, '全球/区域', 'business', 'dashboard').flatMap((group) => group.pages)).toHaveLength(1);
    expect(filterPageCatalog(groups, '全球/区域', 'business', 'report')).toEqual([]);
    expect(filterPageCatalog(groups, 'dashboard').flatMap((group) => group.pages).map((entry) => entry.id).sort())
      .toEqual(dashboard.map((entry) => entry.id).sort());
  });
});
