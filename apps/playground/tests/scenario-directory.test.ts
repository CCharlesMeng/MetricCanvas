import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { componentCatalog, validate } from '@metriccanvas/page';
import { pageFiles } from '../../../tools/scripts/page-files.mjs';
import { scenes } from '../scenarios/catalog';
import { pageEntry } from '../src/lib/page-entry';
import { availableScenes, scenesForTopic, searchScenes, resolveScene, directoryLocation, directoryTopics, catalogHref, exampleHref, sceneRelations, belongsTo } from '../src/lib/scenario-directory';
import { guideSection, guideBlocks, sourceFacts, componentConfiguration, isolatedDocument } from '../src/lib/scenario-guide';

const documents = pageFiles('pages').map(file => ({ file, document: JSON.parse(readFileSync(`pages/${file}`, 'utf8')) }));
const pages = documents.map(({ file, document }) => ({ ...pageEntry(document, file), filePath: file }));
const available = availableScenes(pages);

describe('三维场景目录', () => {
  it('全部场景引用存在，场景标识唯一，每个组件有真实包含该组件的演示', () => {
    expect(new Set(scenes.map(scene => scene.id)).size).toBe(scenes.length);
    expect(available.map(scene => scene.pages)).toEqual(scenes.map(scene => scene.pages));
    for (const scene of scenes) {
      const [dimension, topic] = scene.owner.split('/');
      expect(belongsTo(scene, dimension as 'components' | 'data' | 'layouts', topic!)).toBe(true);
    }
    for (const component of componentCatalog) {
      const matches = scenesForTopic(available, pages, 'components', component.type);
      expect(matches.length, component.type).toBeGreaterThan(0);
      for (const scene of matches) {
        expect(scene.pages.every(id => pages.find(page => page.id === id)!.componentTypes.includes(component.type))).toBe(true);
      }
    }
  });

  it('各数据阶段和布局主题有场景，默认推荐不收临时评测，删除文件只移除对应变体', () => {
    for (const dimension of ['data', 'layouts'] as const) {
      for (const topic of directoryTopics(dimension)) expect(scenesForTopic(available, pages, dimension, topic.id).length).toBeGreaterThan(0);
    }
    for (const layout of ['dashboard', 'report']) {
      const matches = scenesForTopic(available, pages, 'layouts', layout);
      expect(matches.flatMap(scene => scene.pages).every(id => pages.find(page => page.id === id)!.layoutForm === layout)).toBe(true);
    }
    expect(available.flatMap(scene => scene.pages).some(id => pages.find(page => page.id === id)?.filePath?.startsWith('temporary/'))).toBe(false);
    const reduced = availableScenes(pages.filter(page => page.id !== 'table-tiny-os'));
    expect(reduced.find(scene => scene.id === 'table-presentation')?.pages).not.toContain('table-tiny-os');
  });

  it('组件别名、用途和原页面均能命中，同一场景只返回一次', () => {
    expect(searchScenes(available, pages, '列表').map(scene => scene.id)).toContain('table-search');
    expect(searchScenes(available, pages, '子表').map(scene => scene.id)).toContain('child-records');
    expect(searchScenes(available, pages, 'table-row-expansion-query')).toHaveLength(1);
    expect(searchScenes(available, pages, '不存在的能力')).toEqual([]);
  });

  it('跨入口保持场景和变体，失效引用回退到合法值，示例参数显式提供', () => {
    const child = available.find(scene => scene.id === 'child-records')!;
    expect(sceneRelations(child, child.pages[1]).every(item => item.href.includes('scene=child-records') && item.href.includes('example=table-row-expansion-query'))).toBe(true);
    expect(resolveScene([child], 'missing', 'missing')).toMatchObject({ scene: child, example: child.pages[0] });
    expect(directoryLocation('invalid', 'invalid')).toMatchObject({ dimension: 'components', invalid: true });
    expect(catalogHref('components', 'table')).toBe('/catalog/components/table');
    expect(exampleHref('ioc-header-navigation-detail-demo')).toContain('project-id=P-001');
  });
});

describe('场景说明与运行配置', () => {
  it('README 只截取当前场景并保留代码，原始 HTML 作为文字处理', () => {
    const markdown = '# 标题\n## 第一项\n/pages/one\n```json\n{"id":"one"}\n```\n<script>alert(1)</script>\n## 第二项\n/pages/two';
    const section = guideSection(markdown, 'one');
    expect(section).not.toContain('/pages/two');
    expect(guideBlocks(section)).toContainEqual({ kind: 'code', text: '{"id":"one"}' });
    expect(guideBlocks(section)).toContainEqual({ kind: 'text', text: '<script>alert(1)</script>' });
  });

  it('数据关系读取显式条件和消费者，不把结果窗口扩成完整结果', () => {
    const document = documents.find(item => item.document.id === 'filter-group-page')!.document;
    expect(sourceFacts(document).find(source => source.id === 'trend-data')).toMatchObject({ kind: 'query', conditions: ['metric', 'region'] });
    expect(componentConfiguration(document, 'lineChart')).toHaveLength(2);
  });

  it('基础组件可独立投影，完整数据与原文保持，投影仍满足页面协议', () => {
    const document = documents.find(item => item.document.id === 'component-foundations')!.document;
    const before = JSON.stringify(document);
    const projected = isolatedDocument(document, 'gauge');
    expect(validate(projected)).toEqual([]);
    expect(componentConfiguration(projected, 'gauge')).toHaveLength(1);
    expect(componentConfiguration(projected, 'rankingCard')).toEqual([]);
    expect(JSON.stringify(document)).toBe(before);
  });
});
