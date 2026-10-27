import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pageFiles } from '../../../tools/scripts/page-files.mjs';
import { scenes } from '../scenarios/catalog';
import { dataFeatures } from '../scenarios/data-features';
import { pageEntry } from '../src/lib/page-entry';
import { availableScenes, sceneRelations } from '../src/lib/scenario-directory';
import { dataLayout, featureExamples, featuresForLayout, resolveFeature, featureHref, featureSearch } from '../src/lib/data-directory';

const pages = pageFiles('pages').map(file => ({ ...pageEntry(JSON.parse(readFileSync(`pages/${file}`, 'utf8')), file), filePath: file }));
const available = availableScenes(pages);
const dashboard = featuresForLayout(available, pages, 'dashboard');
const report = featuresForLayout(available, pages, 'report');

describe('按功能与实际布局形态查找数据能力', () => {
  it('功能标识唯一，所有演示引用存在于原场景中，查询环境不复制', () => {
    expect(new Set(dataFeatures.map(feature => feature.id)).size).toBe(dataFeatures.length);
    for (const feature of dataFeatures) {
      const entries = featureExamples(feature, available, pages);
      expect(entries.length, feature.id).toBe(feature.examples.reduce((count, reference) => count + reference.pages.length, 0));
      expect(new Set(entries.map(example => example.entry.id)).size, feature.id).toBe(entries.length);
      for (const example of entries) expect(scenes.find(scene => scene.id === example.scene.id)?.pages).toContain(example.entry.id);
    }
  });

  it('按实际页面布局筛选，混合场景不会把另一种布局带进功能演示', () => {
    for (const [layout, features] of [['dashboard', dashboard], ['report', report]] as const) {
      expect(features.every(feature => feature.entries.every(example => example.entry.layoutForm === layout))).toBe(true);
      expect(features.some(feature => feature.topic === 'conditions')).toBe(true);
    }
    expect(dashboard.find(feature => feature.id === 'time-range')?.entries.map(example => example.entry.id)).toContain('dashboard-period-filter');
    expect(report.find(feature => feature.id === 'time-range')?.entries.map(example => example.entry.id)).toContain('ioc-header-detail-demo');
    expect(report.find(feature => feature.id === 'excel')?.entries.map(example => example.entry.id)).toEqual(['table-toolbar-demo']);
    expect(dashboard.some(feature => feature.id === 'pdf')).toBe(false);
  });

  it('功能只推荐直接相关的演示，不整组挂载场景变体', () => {
    expect(dashboard.find(feature => feature.id === 'keyed-join')?.entries.map(example => example.entry.id)).toEqual(['multi-query-table', 'record-join-demo']);
    expect(dashboard.find(feature => feature.id === 'ordered-merge')?.entries.map(example => example.entry.id)).toEqual(['multi-source-table', 'decision-opinion-details']);
    expect(dashboard.find(feature => feature.id === 'month-set')?.entries.map(example => example.entry.id)).not.toContain('ioc-header-overview-demo');
    const reduced = featuresForLayout(availableScenes(pages.filter(page => !['multi-query-table', 'record-join-demo'].includes(page.id))), pages, 'dashboard');
    expect(reduced.some(feature => feature.id === 'keyed-join')).toBe(false);
  });

  it('原场景深链接按真实布局和演示定位，显式形态优先，不可用功能有回退信号', () => {
    const legacy = new URLSearchParams('scene=export&example=table-toolbar-demo');
    expect(dataLayout(available, pages, legacy)).toBe('report');
    expect(resolveFeature(report.filter(feature => feature.topic === 'output'), legacy).example?.entry.id).toBe('table-toolbar-demo');
    expect(dataLayout(available, pages, new URLSearchParams('scene=export'))).toBe('report');
    expect(dataLayout(available, pages, new URLSearchParams('layout=dashboard&example=table-toolbar-demo'))).toBe('dashboard');
    expect(resolveFeature(dashboard.filter(feature => feature.topic === 'output'), new URLSearchParams('feature=pdf'))).toMatchObject({ unavailable: true });
    expect(resolveFeature([], new URLSearchParams('feature=gone'))).toMatchObject({ feature: undefined, example: undefined, unavailable: true });
    expect(resolveFeature(report, new URLSearchParams('feature=time-range&example=ioc-header-demo'))).toMatchObject({ staleExample: true });
  });

  it('功能链接封装运行参数，跨目录精确指向功能；功能搜索不混入其他布局或临时页', () => {
    const feature = report.find(feature => feature.id === 'cross-page')!;
    const example = feature.entries.find(example => example.entry.id === 'ioc-header-navigation-detail-demo')!;
    const search = 'project-id=P%26中文%2F001&month=2026-09';
    const url = new URL(featureHref(feature, 'report', example, search), 'http://test.local');
    expect(url.searchParams.get('exampleSearch')).toBe(search);
    expect(url.searchParams.get('feature')).toBe('cross-page');
    expect(url.searchParams.get('layout')).toBe('report');
    expect(sceneRelations(example.scene, example.entry.id, search).find(link => link.title === '跨页传值')?.href).toContain('feature=cross-page');
    expect(featureSearch(dashboard, '补列').map(feature => feature.id)).toEqual(['keyed-join']);
    expect(featureSearch(report, 'PDF').map(feature => feature.id)).toContain('pdf');
    expect(featureSearch(dashboard, 'PDF')).toEqual([]);
    expect([...dashboard, ...report].flatMap(feature => feature.entries).some(example => example.entry.filePath?.startsWith('temporary/'))).toBe(false);
  });
});
