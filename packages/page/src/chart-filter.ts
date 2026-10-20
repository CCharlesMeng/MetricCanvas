import { filterDependencies } from './filter-dependencies';
import { collectFilterTextValueReferences } from './filter-text-value';
import { flattenPageComponents, walkPageComponents } from './component-walk';
import { affectedSourceIds, conditionSourceIds } from './data-source-references';
import { isChartComponent, type Page, type Component } from './page';
import type { TypedError } from './errors';

export function chartFilterOptions(page: { sections: ReadonlyArray<{components: readonly Component[]}>; detailViews?: ReadonlyArray<{components: readonly Component[]}> }): Map<string, readonly string[]> {
  return new Map(flattenPageComponents(page).flatMap(component =>
    isChartComponent(component) && component.props.filter
      ? [[component.props.filter.filterId, component.props.filter.options.map(option => option.value)] as const]
      : []));
}

/** A local control may only affect its owner's query graph and displayed data. */
export function chartFilterErrors(page: Page, document: unknown = page): TypedError[] {
  const errors: TypedError[] = [];
  const error = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  const owners = new Set<string>();
  const components = flattenPageComponents(page);
  walkPageComponents(page, (component, path) => {
    if (!isChartComponent(component) || !component.props.filter) return;
    const control = component.props.filter;
    const location = `${path}/props/filter`;
    if (page.layout !== 'dashboard' || path.startsWith('/detailViews/')) error(location, '图表筛选只用于 Dashboard 正文图表');
    const declaration = page.filters?.find(filter => filter.id === control.filterId);
    if (!declaration || declaration.type !== 'dimension' || declaration.hierarchy || declaration.dependsOn || declaration.candidateContext || declaration.clearOnChangeOf || declaration.options || declaration.selection || declaration.initialParam || declaration.visible === false) {
      error(`${location}/filterId`, '图表筛选必须引用独立、可见、非层级的维度筛选器，初值由 default 声明');
      return;
    }
    if (owners.has(declaration.id)) error(`${location}/filterId`, '一个图表筛选器只能属于一张图');
    owners.add(declaration.id);
    const values = control.options.map(option => option.value);
    if (new Set(values).size !== values.length) error(`${location}/options`, '图表筛选选项的 value 不得重复');
    if (declaration.default?.length !== 1 || !values.includes(declaration.default[0]!)) error(`${location}/filterId`, '图表筛选 default 必须是候选项中的一个值');
    if (page.filters?.some(filter => filterDependencies(filter).includes(declaration.id))) error(`${location}/filterId`, '图表筛选不能驱动其他筛选器的级联');

    const roots = Object.entries(page.dataSources).flatMap(([id, source]) =>
      source.source.type === 'query' && source.source.query.filterBindings?.[declaration.id] ? [id] : []);
    for (const [id, source] of Object.entries(page.dataSources)) {
      if ((source.compute ?? []).some(op => op.op === 'selectField' && op.filter === declaration.id || op.op === 'timeFill' && 'filter' in op.range && op.range.filter === declaration.id)) roots.push(id);
    }
    for (const usage of collectFilterTextValueReferences(document)) {
      if (usage.reference.filter === declaration.id && !usage.path.startsWith(`${path}/`)) error(usage.path, '图表独立筛选不能改变其他位置的文字');
    }
    const owned = conditionSourceIds(page, component.data.main);
    const source = page.dataSources[component.data.main];
    if (source?.source.type !== 'query' || !roots.some(id => owned.has(id))) error(location, '图表筛选需要绑定本图普通查询数据源的 filterBindings');
    if (roots.some(id => !owned.has(id))) error(location, '图表筛选不能绑定本图依赖之外的查询');
    const affected = affectedSourceIds(page.dataSources, roots);
    for (const other of components) {
      if (other === component || other.type === 'compositeCard' || other.type === 'tabContainer') continue;
      const readsAffected = Object.values(other.data ?? {}).some(id => affected.has(id));
      const summaryAffected = other.type === 'aiSummary' && Object.values(other.props.relatedData).some(data => affected.has(data.source));
      if (readsAffected || summaryAffected) error(location, `图表筛选会影响其他组件 ${other.id}，请使用独立查询数据源`);
    }
  });
  return errors;
}
