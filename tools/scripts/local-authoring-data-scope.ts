import { walkDocumentComponents } from '../../packages/page/src/component-walk';
import { affectedSourceIds, conditionSourceIds } from '../../packages/page/src/data-source-references';
import type { DataSources } from '../../packages/page/src/data-source';
import type { scanPageData } from './local-authoring-data-analysis';

type Json = Record<string, any>;
type Scan = ReturnType<typeof scanPageData>;
interface ComponentLocation { id: string; type: string; path: string }

function componentLocations(page: Json): ComponentLocation[] {
  const locations: ComponentLocation[] = [];
  walkDocumentComponents(page, (component, path) => {
    locations.push({ id: String(component.id ?? ''), type: String(component.type ?? ''), path });
  });
  return locations;
}

function requestedLocations(locations: ComponentLocation[], ids: string[]): ComponentLocation[] {
  return [...new Set(ids)].map(id => {
    const matches = locations.filter(component => component.id === id);
    if (matches.length !== 1) {
      throw new TypeError(`--component ${id}: expected one component, found ${matches.length}; run scan without --component to locate it`);
    }
    return matches[0];
  });
}

function within(path: string, parent: string): boolean {
  return path === parent || path.startsWith(parent + '/');
}

function sourceScope(page: Json, seeds: string[]): Set<string> {
  // Reuse product query-result, compute and paged member references. No row data is needed.
  const sources: DataSources = page.dataSources ?? {};
  const affected = affectedSourceIds(sources, seeds);
  const included = new Set<string>();
  for (const id of affected) {
    for (const dependency of conditionSourceIds({ dataSources: sources }, id)) included.add(dependency);
  }
  return included;
}

function addAncestors(locations: ComponentLocation[], ids: Set<string>): void {
  const consumers = locations.filter(component => ids.has(component.id));
  for (const location of locations) {
    if (consumers.some(child => within(child.path, location.path))) ids.add(location.id);
  }
}

function readingClosure(page: Json, scan: Scan, locations: ComponentLocation[], selected: ComponentLocation[]) {
  const ids = new Set(selected.map(component => component.id));
  let sources = new Set<string>();
  let previousSize = -1;
  while (previousSize !== ids.size + sources.size) {
    previousSize = ids.size + sources.size;
    addAncestors(locations, ids);
    const uses = scan.uses.filter(use => use.componentType === 'page' || ids.has(use.componentId) || sources.has(use.source ?? ''));
    uses.forEach(use => ids.add(use.componentId));
    sources = sourceScope(page, [...sources, ...uses.flatMap(use => typeof use.source === 'string' ? [use.source] : [])]);
  }
  return { ids, sources };
}

/** A smaller reading view, never a smaller validation or matching-coverage boundary. */
export function scopePageData(page: Json, scan: Scan, componentIds: string[]) {
  const locations = componentLocations(page);
  const requested = requestedLocations(locations, componentIds);
  const selected = locations.filter(component => requested.some(root => within(component.path, root.path)));
  const { ids: consumerIds, sources: sourceIds } = readingClosure(page, scan, locations, selected);
  const uses = scan.uses.filter(use => consumerIds.has(use.componentId));
  const missingSources = [...sourceIds].filter(id => !Object.hasOwn(scan.sources, id));
  return {
    ...scan,
    uses,
    sources: Object.fromEntries(Object.entries(scan.sources).filter(([id]) => sourceIds.has(id))),
    diagnostics: [...scan.diagnostics, ...missingSources.map(source => ({ type: 'UNKNOWN_SOURCE', source }))],
    selectedComponents: selected,
    consumers: locations.filter(component => consumerIds.has(component.id)),
    scope: {
      requestedComponents: [...new Set(componentIds)],
      sourceIds: [...sourceIds],
      totalComponents: locations.length,
      totalSources: Object.keys(scan.sources).length,
      totalUses: scan.uses.length,
      note: 'Reading scope only; global filters, params and diagnostics retained. Validate the complete page.'
    }
  };
}
