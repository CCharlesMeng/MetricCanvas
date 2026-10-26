import { componentCatalog } from '@metriccanvas/page';
import { scenes, pageSearchInputs, type Scene } from '../../scenarios/catalog';
import { dataFeatures } from '../../scenarios/data-features';
import type { PlaygroundPageEntry } from './page-entry';

export type Dimension = 'components' | 'data' | 'layouts';
export const dimensions = [
  { value: 'components', label: '组件' }, { value: 'data', label: '数据与联动' }, { value: 'layouts', label: '布局' }
];
export const dataTopics = [
  { id: 'sources', title: '1 定义取数', description: '数据来源、查询定义与结果字段' },
  { id: 'conditions', title: '2 条件驱动查询', description: '时间、维度、候选与查询范围' },
  { id: 'relationships', title: '3 数据关联与组合', description: '共享来源、结果组合与主从关系' },
  { id: 'interactions', title: '4 交互联动与继续查数', description: '记录选择、下钻与按行查明细' },
  { id: 'results', title: '5 查询结果与范围', description: '搜索、排序、分页与完整结果' },
  { id: 'output', title: '6 跨页延续与输出', description: '传值、URL、导出与 AI 总结' }
];
export const layoutTopics = [
  { id: 'dashboard', title: 'Dashboard · 看板', description: '满幅外框与并列主题' },
  { id: 'report', title: 'Report · 报表', description: '定宽外框与章节阅读' },
  { id: 'sections', title: '内容分区与网格', description: '分区容器、标题与排列' },
  { id: 'containers', title: '容器组合与嵌套', description: 'Tab 与组合卡的内容组织' }
];

export function directoryTopics(dimension: Dimension) {
  if (dimension === 'data') return dataTopics;
  if (dimension === 'layouts') return layoutTopics;
  return componentCatalog.map(item => ({ id: item.type, title: item.label, description: item.purpose }));
}

export function directoryLocation(dimension?: string, topic?: string) {
  const kind = dimensions.some(item => item.value === dimension) ? dimension as Dimension : 'components';
  const topics = directoryTopics(kind);
  const selected = topics.find(item => item.id === topic) ?? topics[0]!;
  return { dimension: kind, topic: selected, invalid: Boolean(topic && topic !== selected.id) };
}

export function belongsTo(scene: Scene, dimension: Dimension, topic: string): boolean {
  if (dimension === 'components') return scene.components.some(value => value === topic);
  if (dimension === 'data') return scene.topics.some(value => value === topic);
  return scene.layouts?.some(value => value === topic) ?? false;
}

export function availableScenes(pages: PlaygroundPageEntry[]): Scene[] {
  const ids = new Set(pages.map(page => page.id));
  return scenes.map(scene => ({ ...scene, pages: scene.pages.filter(id => ids.has(id)) }))
    .filter(scene => scene.pages.length > 0);
}

export function scenesForTopic(available: Scene[], pages: PlaygroundPageEntry[], dimension: Dimension, topic: string): Scene[] {
  const matching = available.filter(scene => belongsTo(scene, dimension, topic));
  const byComponent = dimension === 'components';
  const byLayout = dimension === 'layouts' && ['dashboard', 'report'].includes(topic);
  if (!byComponent && !byLayout) return matching;
  const ids = new Set(pages.filter(page => byComponent ? page.componentTypes.includes(topic) : page.layoutForm === topic).map(page => page.id));
  return matching.map(scene => ({ ...scene, pages: scene.pages.filter(id => ids.has(id)) }))
    .filter(scene => scene.pages.length > 0);
}

function sceneSearchText(scene: Scene, pages: PlaygroundPageEntry[]): string {
  const components = componentCatalog.filter(item => scene.components.includes(item.type));
  const documents = pages.filter(page => scene.pages.includes(page.id));
  return [scene.title, scene.question, ...scene.topics.map(id => dataTopics.find(topic => topic.id === id)?.title),
    ...components.flatMap(item => [item.type, item.label, ...item.aliases]),
    ...documents.flatMap(page => [page.id, page.title, page.description])].join(' ').toLocaleLowerCase();
}

export function searchScenes(available: Scene[], pages: PlaygroundPageEntry[], query: string): Scene[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return available.filter(scene => words.every(word => sceneSearchText(scene, pages).includes(word)));
}

export function catalogHref(dimension: Dimension, topic: string, scene?: string, pageId?: string, exampleSearch?: string, feature?: string): string {
  const params = new URLSearchParams();
  if (scene) params.set('scene', scene);
  if (pageId) params.set('example', pageId);
  if (exampleSearch !== undefined) params.set('exampleSearch', exampleSearch);
  if (feature) params.set('feature', feature);
  return `/catalog/${dimension}/${encodeURIComponent(topic)}${params.size ? `?${params}` : ''}`;
}

export function exampleHref(pageId: string): string {
  const search = pageSearchInputs[pageId];
  return `/pages/${encodeURIComponent(pageId)}${search ? `?${search}` : ''}`;
}

export function sceneHomeHref(scene: Scene): string {
  const [dimension, topic] = scene.owner.split('/') as [Dimension, string];
  return catalogHref(dimension, topic, scene.id);
}

export function sceneBreadcrumb(scene: Scene): string {
  const [dimension, topic] = scene.owner.split('/') as [Dimension, string];
  return `${dimensions.find(item => item.value === dimension)!.label} › ${directoryTopics(dimension).find(item => item.id === topic)!.title} › ${scene.title}`;
}

export function resolveScene(available: Scene[], sceneId: string | null, pageId: string | null) {
  const scene = available.find(item => item.id === sceneId) ?? available[0];
  const example = scene?.pages.find(id => id === pageId) ?? scene?.pages[0];
  return { scene, example };
}

export function sceneRelations(scene: Scene, pageId?: string, exampleSearch?: string) {
  return [
    ...scene.components.map(id => ({ title: componentCatalog.find(item => item.type === id)!.label, href: catalogHref('components', id, scene.id, pageId, exampleSearch) })),
    ...dataFeatures.filter(feature => feature.examples.some(reference => reference.scene === scene.id && (!pageId || reference.pages.includes(pageId))))
      .map(feature => ({ title: feature.title, href: catalogHref('data', feature.topic, scene.id, pageId, exampleSearch, feature.id) }))
  ];
}
