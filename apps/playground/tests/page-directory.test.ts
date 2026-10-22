import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pageFiles } from '../../../tools/scripts/page-files.mjs';
import { pageEntry } from '../src/lib/page-entry';
import { pageFolders, filterPageDirectory, folderIncludes, organizePageDirectory } from '../src/lib/page-directory';
import { indexPagePaths, relativePagePath } from '../src/lib/page-file-index';

const pages = pageFiles('pages').map(file => ({
  ...pageEntry(JSON.parse(readFileSync(`pages/${file}`, 'utf8')), file), filePath: file
}));
const groups = organizePageDirectory(pages);
const ids = (folder: string) => filterPageDirectory(groups, '', 'all', 'all', 'all', folder)
  .flatMap(group => group.pages).map(page => page.id).sort();

describe('页面目录：文件与文档是唯一输入', () => {
  it('发现全部页面且只出现一次，父目录包含全部后代', () => {
    expect(ids('all')).toEqual(pages.map(page => page.id).sort());
    expect(ids('business')).toHaveLength(pages.filter(page => page.filePath.startsWith('business/')).length);
    expect(ids('business/dashboard/ioc/project')).toEqual(expect.arrayContaining(['ioc-project-detail', 'ioc-project-overview']));
    expect(ids('business/dashboard/ioc/opportunity')).toEqual(expect.arrayContaining(['ioc-opportunity-analysis', 'ioc-opportunity-list']));
    expect(folderIncludes('capabilities/table', 'capabilities/tab')).toBe(false);
    for (const layout of ['report', 'dashboard']) {
      expect(filterPageDirectory(groups, '', 'all', 'all', 'all', `business/${layout}`)
        .flatMap(group => group.pages).every(page => page.layoutForm === layout)).toBe(true);
    }
  });

  it('新业务目录直接出现，标题和说明来自文档，空目录和已删除文件不出现', () => {
    const source = JSON.parse(readFileSync('pages/capabilities/layout/demo.json', 'utf8'));
    source.id = 'supply-overview'; source.layout = 'dashboard'; source.meta.description = '供应链测试';
    const entry = { ...pageEntry(source, source.id), filePath: 'business/dashboard/供应链/supply-overview.json' };
    const expanded = organizePageDirectory([...pages, entry]);
    const matches = filterPageDirectory(expanded, '供应链', 'dashboard', 'all', 'query', 'business/dashboard/供应链');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.title).toBe('business/dashboard/供应链');
    expect(matches[0]?.pages).toEqual([entry]);
    expect(matches[0]?.pages[0]?.description).toBe('供应链测试');
    expect(pageFolders([...pages, entry]).find(folder => folder.path === 'business/dashboard/供应链')?.count).toBe(1);
    expect(pageFolders(pages).some(folder => folder.path === 'business/dashboard/供应链')).toBe(false);
  });

  it('组件来自完整嵌套组件树，数据来源来自实际数据源，过滤可组合', () => {
    const project = pages.find(page => page.id === 'ioc-project-overview')!;
    expect(project.dataKind).toBe('query');
    expect(project.componentTypes).toContain('table');
    const matches = filterPageDirectory(groups, 'multi-query-table', 'dashboard', 'table', 'query', 'capabilities/table')
      .flatMap(group => group.pages);
    expect(matches.map(page => page.id)).toEqual(['multi-query-table']);
    expect(filterPageDirectory(groups, 'multi-query-table', 'dashboard', 'table', 'inline')).toEqual([]);
    expect(pages.find(page => page.id === 'table-detail-overlay')?.dataKind).toBe('inline');
  });

  it('无效文档不猜测组件和数据，布局与正式渲染一致', () => {
    expect(pageEntry({ id: 'broken', layout: 'dashboard', meta: { description: '错误原文' } }, 'broken'))
      .toMatchObject({ title: 'broken', layoutForm: 'dashboard', dataKind: 'unknown', componentTypes: [], description: '错误原文' });
    expect(pageEntry({ layout: 'report', layoutForm: 'dashboard' }, 'legacy').layoutForm).toBe('report');
    expect(pageEntry({}, 'default').layoutForm).toBe('report');
  });

  it('根文件和未知目录可发现，跨目录重名明确失败，Windows 路径保持一致', () => {
    const root = { ...pages[0]!, id: 'root', filePath: 'root.json' };
    expect(organizePageDirectory([root])[0]?.title).toBe('根目录');
    expect(pageFolders([root]).map(folder => folder.path)).toEqual(['.']);
    expect(() => indexPagePaths(['$pages/a/demo.json', '$pages/b/demo.json'])).toThrow(/重复页面 ID demo/);
    expect(relativePagePath('C:\\repo\\pages\\business\\report\\demo.json')).toBe('business/report/demo.json');
    expect(indexPagePaths(['/repo/pages/business/report/demo.json']).get('demo')).toBe('/repo/pages/business/report/demo.json');
  });
});
