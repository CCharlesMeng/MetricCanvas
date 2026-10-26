import { dataFeatures, type DataFeature } from '../../scenarios/data-features';
import type { Scene } from '../../scenarios/catalog';
import type { PlaygroundPageEntry } from './page-entry';
import { catalogHref } from './scenario-directory';

export type DataLayout = PlaygroundPageEntry['layoutForm'];
export interface FeatureExample { scene: Scene; entry: PlaygroundPageEntry }
export interface FeatureView extends DataFeature { entries: FeatureExample[] }
export const dataLayouts = [{ value: 'dashboard', label: 'Dashboard · 看板' }, { value: 'report', label: 'Report · 报表' }];

export function dataLayout(available: Scene[], pages: PlaygroundPageEntry[], params: URLSearchParams): DataLayout {
  const explicit = params.get('layout');
  if (explicit === 'dashboard' || explicit === 'report') return explicit;
  const legacyPage = params.get('example') ?? available.find(scene => scene.id === params.get('scene'))?.pages[0];
  return pages.find(page => page.id === legacyPage)?.layoutForm ?? 'dashboard';
}

export function featureExamples(feature: DataFeature, available: Scene[], pages: PlaygroundPageEntry[]): FeatureExample[] {
  return feature.examples.flatMap(reference => {
    const scene = available.find(item => item.id === reference.scene);
    if (!scene) return [];
    return pagesForReference(scene, reference.pages, pages);
  });
}

function pagesForReference(scene: Scene, ids: string[], pages: PlaygroundPageEntry[]): FeatureExample[] {
  return ids.flatMap(id => {
    const entry = pages.find(page => page.id === id);
    return entry && scene.pages.includes(id) ? [{ scene, entry }] : [];
  });
}

export function featuresForLayout(available: Scene[], pages: PlaygroundPageEntry[], layout: DataLayout): FeatureView[] {
  return dataFeatures.map(feature => ({ ...feature, entries: featureExamples(feature, available, pages).filter(example => example.entry.layoutForm === layout) }))
    .filter(feature => feature.entries.length > 0);
}

export function resolveFeature(features: FeatureView[], params: URLSearchParams) {
  const requested = params.get('feature');
  const feature = features.find(item => item.id === requested)
    ?? features.find(item => item.entries.some(example => example.entry.id === params.get('example')))
    ?? features.find(item => item.entries.some(example => example.scene.id === params.get('scene')))
    ?? features[0];
  const example = feature?.entries.find(item => item.entry.id === params.get('example')) ?? feature?.entries[0];
  const unavailable = requested !== null && requested !== feature?.id;
  const staleExample = params.has('example') && params.get('example') !== example?.entry.id;
  return { feature, example, unavailable, staleExample };
}

export function featureHref(feature: DataFeature, layout: DataLayout, example?: FeatureExample, runtimeSearch?: string): string {
  const url = new URL(catalogHref('data', feature.topic, example?.scene.id, example?.entry.id, runtimeSearch), 'http://catalog.local');
  url.searchParams.set('layout', layout);
  url.searchParams.set('feature', feature.id);
  return url.pathname + url.search;
}

export function featureSearch(features: FeatureView[], query: string): FeatureView[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return features.filter(feature => {
    const text = [feature.id, feature.title, feature.description, ...feature.entries.flatMap(example => [example.entry.id, example.entry.title, example.entry.description])].join(' ').toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}
