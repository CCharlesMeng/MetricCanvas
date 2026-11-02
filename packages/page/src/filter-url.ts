import type { FilterDeclaration } from './filter';

/** IOC Header owns the fixed organization URL names; ordinary filters keep their existing keys. */
export function filterURLKeys(filter: FilterDeclaration, iocRegion = false): Record<string, string> {
  const names = filter.urlParams ?? {};
  const value = names.value ?? filter.id;
  if (filter.type === 'timeRange' || filter.type === 'numberRange') {
    const range = { from: names.from ?? `${filter.id}.from`, to: names.to ?? `${filter.id}.to` };
    if (filter.type === 'timeRange' && filter.display === 'period') return { value, ...range };
    if (filter.type === 'timeRange' && filter.display === 'modes') return { mode: `${filter.id}.mode`, ...range };
    return range;
  }
  if (filter.type !== 'dimension' || !filter.hierarchy) return { value };
  return { value, level: names.level ?? `${filter.id}.level`, ...(iocRegion ? iocRegionLevelKeys(filter) : {}) };
}

/** department is an existing IOC level ID; new pages use region-dept. */
function iocRegionLevelKeys(filter: Extract<FilterDeclaration, { type: 'dimension' }>): Record<string, string> {
  if (filter.id !== 'region') return {};
  const levels = new Set(filter.hierarchy?.map(level => level.id));
  const department = ['region-dept', 'department'].find(level => levels.has(level));
  const keys: Record<string, string> = {};
  if (department) keys[`node/${department}`] = 'region-dept';
  if (levels.has('office')) keys['node/office'] = 'rep-office';
  return keys;
}

/** URL order is authoritative, including repeated keys. An empty final value stays invalid. */
export function readLevelURLSelection(keys: Readonly<Record<string, string>>, query: URLSearchParams): { key: string; level: string; value: string } | undefined {
  const levels = new Map(Object.entries(keys).filter(([part]) => part.startsWith('node/')).map(([part, key]) => [key, part.slice(5)]));
  let selected: { key: string; level: string; value: string } | undefined;
  for (const [key, value] of query) {
    const level = levels.get(key);
    if (level !== undefined) selected = { key, level, value };
  }
  return selected;
}
