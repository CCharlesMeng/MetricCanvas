import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import catalog from '../page-catalog.json';
import { catalogCapabilities, catalogRuntimes, filterPageCatalog, organizePageCatalog } from '../src/lib/page-catalog';
import { catalogPageEntry } from '../src/lib/page-catalog-entry';
import { guideConfig } from '../src/lib/page-guide-config';

const directory = fileURLToPath(new URL('../../../pages/', import.meta.url));
const pageFiles = readdirSync(directory, { recursive: true }).map(String).filter((file) => file.endsWith('.json'));
const documents = pageFiles.map((file) => JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')));

describe('页面试验场目录', () => {
  it('现有样例都明确归类且仅出现一次，目录只展示存在页面', () => {
    const ids = documents.map((page) => page.id);
    expect(catalog.pages.map((page) => page.id).sort()).toEqual(ids.sort());
    expect(new Set(catalog.pages.map((page) => page.id)).size).toBe(catalog.pages.length);
    const groups = organizePageCatalog(ids.map((id) => ({ id, title: id, layoutForm: 'report' })));
    expect(groups.flatMap((group) => group.pages).map((page) => page.id).sort()).toEqual(ids);
  });

  it('时间选择只有 Report 和 Dashboard 两个通用演示入口', () => {
    const entries = catalog.pages.filter(page => page.tags.includes('时间选择'));
    expect(entries.map(page => page.id).sort()).toEqual(['dashboard-period-filter', 'report-date-filter-example']);
    expect(entries.every(page => page.group === 'features')).toBe(true);
    const retired = ['report-title-filter-example', 'time-point-no-future',
      'dashboard-period-filter-month', 'dashboard-period-filter-more', 'dashboard-period-filter-readonly'];
    const files = readdirSync(fileURLToPath(new URL('../../../pages', import.meta.url)));
    for (const id of retired) {
      expect(catalog.pages.some(page => page.id === id)).toBe(false);
      expect(files).not.toContain(`${id}.json`);
    }
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
    expect(filterPageCatalog(groups, 'EXCEL 导出', 'features').flatMap((group) => group.pages).map(page => page.id).sort()).toEqual(['table-row-number', 'table-toolbar-demo']);
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
    const pages = documents.map((document) => catalogPageEntry(document, document.id));
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

  it('说明中的配置、关联页面、主题和文档在当前仓库真实存在', () => {
    const ids = new Set(documents.map((document) => document.id));
    for (const entry of catalog.pages) {
      const document = documents.find((document) => document.id === entry.id);
      expect(entry.displayTitle.trim(), entry.id).not.toBe('');
      expect(entry.guide.steps.length, entry.id).toBeGreaterThan(0);
      expect(catalogRuntimes.some((runtime) => runtime.id === entry.environment.runtime), entry.id).toBe(true);
      expect(entry.capabilities.length, entry.id).toBeGreaterThan(0);
      for (const id of entry.capabilities) expect(catalogCapabilities.some((topic) => topic.id === id), `${entry.id}: ${id}`).toBe(true);
      for (const id of entry.guide.related) expect(ids.has(id) && id !== entry.id, `${entry.id}: ${id}`).toBe(true);
      for (const selector of entry.guide.configPaths) {
        expect(guideConfig(document, selector).length, `${entry.id}: ${selector}`).toBeGreaterThan(0);
      }
    }
    for (const topic of catalogCapabilities) {
      for (const reference of topic.docs) {
        expect(readFileSync(new URL(`../../../docs/page-metadata/${reference}.md`, import.meta.url), 'utf8').length).toBeGreaterThan(0);
      }
    }
  });

  it('能力允许跨用途归属，且能与运行条件、布局、关键词组合筛选', () => {
    const groups = organizePageCatalog(documents.map((document) => catalogPageEntry(document, document.id)));
    const matches = filterPageCatalog(groups, '只刷新', 'verification', 'dashboard', 'filters', 'sim')
      .flatMap((group) => group.pages);
    expect(matches.map((entry) => entry.id)).toEqual(['chart-local-filter-page']);
    expect(filterPageCatalog(groups, '', 'all', 'all', 'tables', 'none')
      .flatMap((group) => group.pages).map((entry) => entry.id)).toContain('table-detail-overlay');
    expect(filterPageCatalog(groups, '完全不存在的能力', 'all', 'all', 'export', 'none')).toEqual([]);
    expect(filterPageCatalog(groups, '收入构成看板').flatMap((group) => group.pages).map((entry) => entry.id))
      .toEqual(['metric-card-equation']);
  });

  it('读取当前配置，保留空值并提供可定位的实际数组路径', () => {
    const document = { sections: [{ components: [{ props: { filter: null } }, { props: { filter: 'region' } }] }] };
    expect(guideConfig(document, 'sections[].components[].props.filter')).toEqual([
      { path: 'sections[0].components[0].props.filter', value: null },
      { path: 'sections[0].components[1].props.filter', value: 'region' }
    ]);
    expect(guideConfig(document, 'dataSources.*.source.query')).toEqual([]);
  });
});
