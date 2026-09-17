/**
 * Schema 5.x 的页面主体可以由 6.x 直接解释。唯一需要在读取边界换写的
 * 是当时的站内导航：5.x 用 page/carryFilters/setFilters/setParams，6.x
 * 使用普通 href/query。
 *
 * 这是只读适配，不修改调用方传入的历史修订。
 */
export function adaptLegacyPageDocument(document: unknown): unknown {
  if (!isRecord(document) || typeof document.schemaVersion !== 'string' || !/^5\.[0-4]$/.test(document.schemaVersion)) return document;
  const adapted = JSON.parse(JSON.stringify(document)) as Record<string, unknown>;
  const filters = new Map<string, Record<string, unknown>>();
  if (Array.isArray(adapted.filters)) {
    for (const filter of adapted.filters) {
      if (isRecord(filter) && typeof filter.id === 'string') filters.set(filter.id, filter);
    }
  }
  if (Array.isArray(adapted.sections)) {
    for (const section of adapted.sections) {
      if (isRecord(section)) visitComponents(section.components, filters);
    }
  }
  return adapted;
}

function visitComponents(value: unknown, filters: ReadonlyMap<string, Record<string, unknown>>): void {
  if (!Array.isArray(value)) return;
  for (const component of value) {
    if (!isRecord(component) || !isRecord(component.props)) continue;
    adaptLinks(component.props, filters);
    adaptActions(component.props, filters);
    visitComponents(component.props.components, filters);
    const tabs = component.props.tabs;
    if (!Array.isArray(tabs)) continue;
    for (const tab of tabs) {
      if (!isRecord(tab)) continue;
      visitComponents(tab.component === undefined ? tab.components : [tab.component], filters);
    }
  }
}

function adaptLinks(props: Record<string, unknown>, filters: ReadonlyMap<string, Record<string, unknown>>): void {
  if (!Array.isArray(props.links)) return;
  props.links = props.links.map((link) => isRecord(link) ? adaptTarget(link, filters) : link);
}

function adaptActions(props: Record<string, unknown>, filters: ReadonlyMap<string, Record<string, unknown>>): void {
  if (!Array.isArray(props.actions)) return;
  props.actions = props.actions.map((action) => {
    if (!isRecord(action) || !isRecord(action.navigate)) return action;
    return { ...action, navigate: adaptTarget(action.navigate, filters) };
  });
}

function adaptTarget(
  target: Record<string, unknown>,
  filters: ReadonlyMap<string, Record<string, unknown>>
): Record<string, unknown> {
  if (typeof target.page !== 'string') return target;
  const { page, carryFilters, setFilters, setParams } = target;
  const query: Record<string, unknown> = {};
  if (Array.isArray(carryFilters)) {
    for (const id of carryFilters) {
      if (typeof id !== 'string') continue;
      const filter = filters.get(id);
      if (!filter) continue;
      for (const [part, key] of Object.entries(filterURLKeys(filter))) {
        query[key] = { source: 'filter', id, ...(part === 'value' ? {} : { part }) };
      }
    }
  }
  for (const bindings of [setFilters, setParams]) {
    if (!isRecord(bindings)) continue;
    for (const [key, binding] of Object.entries(bindings)) {
      const field = typeof binding === 'string'
        ? binding
        : isRecord(binding) && typeof binding.field === 'string'
          ? binding.field
          : undefined;
      if (field) query[key] = { source: 'row', field };
    }
  }
  return {
    href: `/pages/${encodeURIComponent(page)}`,
    ...(Object.keys(query).length > 0 ? { query } : {})
  };
}

function filterURLKeys(filter: Record<string, unknown>): Record<string, string> {
  if (filter.type === 'timeRange' || filter.type === 'numberRange') {
    return { from: `${String(filter.id)}.from`, to: `${String(filter.id)}.to` };
  }
  return {
    value: String(filter.id),
    ...(filter.type === 'dimension' && Array.isArray(filter.hierarchy)
      ? { level: `${String(filter.id)}.level` }
      : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
