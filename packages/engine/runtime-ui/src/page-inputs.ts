import {
  conditionSourceIds, resolveDataSourceFields, sourceFilterIds, tableHeaderParamReferences,
  type Page, type PageParamValue
} from '@metriccanvas/page/internal';
import { initializePageParams } from '../../runtime/src/page-params';

/** Query references and legacy bindings are inspected only after document validation. */
function consumesMissingParam(value: unknown, missing: ReadonlySet<string>): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => consumesMissingParam(item, missing));
  const node = value as Record<string, unknown>;
  if (typeof node.param === 'string' && missing.has(node.param)) return true;
  if (node.paramBindings && Object.keys(node.paramBindings).some(id => missing.has(id))) return true;
  return Object.values(node).some(child => consumesMissingParam(child, missing));
}

export function missingInputSources(page: Page, missing: ReadonlySet<string>): Set<string> {
  const filters = new Set((page.filters ?? []).filter(filter => 'initialParam' in filter && missing.has(filter.initialParam ?? '')).map(filter => filter.id));
  const direct = new Set(tableHeaderParamReferences(page).filter(ref => missing.has(ref.id)).map(ref => ref.source));
  for (const [id, source] of Object.entries(page.dataSources)) {
    if (source.source.type === 'query' && consumesMissingParam(source.source.query, missing)) direct.add(id);
    if (sourceFilterIds(source).some(id => filters.has(id))) direct.add(id);
  }
  let blocked = inputDependencyClosure(page, direct);
  let size = -1;
  while (size !== blocked.size) {
    size = blocked.size;
    const candidates = new Set((page.filters ?? []).filter(filter => filter.type === 'dimension' && filter.candidates && blocked.has(filter.candidates.dataSource)).map(filter => filter.id));
    for (const [id, source] of Object.entries(page.dataSources)) if (sourceFilterIds(source).some(id => candidates.has(id))) blocked.add(id);
    blocked = inputDependencyClosure(page, blocked);
  }
  return blocked;
}

function inputDependencyClosure(page: Page, direct: ReadonlySet<string>): Set<string> {
  return new Set(Object.keys(page.dataSources).filter(id => [...conditionSourceIds(page, id)].some(key => direct.has(key))));
}

/**
 * An execution-free projection for incomplete URL inputs. Never save this copy:
 * the original document owns queries and required declarations for the next load.
 * Empty sources also cover candidate reads, tables, inactive Tabs and frozen exports.
 */
export function initializeRenderablePage(page: Page, values: ReadonlyMap<string, PageParamValue>, missing: readonly string[]): Page {
  if (!missing.length) return initializePageParams(page, values);
  const unavailable = new Set(missing);
  const blocked = missingInputSources(page, unavailable);
  const projected = structuredClone(page);
  for (const id of blocked) projected.dataSources[id] = { fields: resolveDataSourceFields(page.dataSources[id]), source: { type: 'inline', rows: [] } };
  for (const declaration of projected.params ?? []) {
    if (!unavailable.has(declaration.id)) continue;
    declaration.required = false;
    delete declaration.value;
    delete declaration.default;
  }
  return initializePageParams(projected, values);
}
