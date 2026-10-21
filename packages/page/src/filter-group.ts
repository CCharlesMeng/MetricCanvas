import { filterDependencies } from './filter-dependencies';
import { flattenPageComponents, walkPageComponents, walkDocumentComponents } from './component-walk';
import type { FilterDeclaration } from './filter';
import type { Page, Component } from './page';
import type { TypedError } from './errors';

export function filterGroupOptions(page: { sections: ReadonlyArray<{components: readonly Component[]}>; detailViews?: ReadonlyArray<{components: readonly Component[]}> }): Map<string, readonly string[]> {
  return new Map(flattenPageComponents(page).flatMap(component => component.type === 'filterGroup'
    ? [[component.props.filterId, component.props.options.map(option => option.value)] as const] : []));
}

function isIndependentDimension(filter: FilterDeclaration | undefined): filter is Extract<FilterDeclaration,{type:'dimension'}> {
  if (!filter || filter.type !== 'dimension') return false;
  return !['hierarchy','dependsOn','candidateContext','clearOnChangeOf','options','selection','initialParam','candidateWindow'].some(key => key in filter);
}

/** Placement owns the control; query filterBindings alone own the affected sources. */
export function filterGroupErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [], owners = new Set<string>();
  const error = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  walkPageComponents(page, (component, path) => {
    if (component.type !== 'filterGroup') return;
    const control = component.props, location = `${path}/props`;
    if (page.layout !== 'dashboard' || path.startsWith('/detailViews/')) error(path, '筛选按钮组只用于 Dashboard 正文或组合卡');
    const declaration = page.filters?.find(filter => filter.id === control.filterId);
    if (!isIndependentDimension(declaration)) {
      error(`${location}/filterId`, '筛选按钮组必须引用独立、非层级的维度筛选器，固定选项由组件声明，初值由 default 声明');
      return;
    }
    if (owners.has(declaration.id)) error(`${location}/filterId`, '同一个筛选器只能声明一个筛选按钮组');
    owners.add(declaration.id);
    const values = control.options.map(option => option.value);
    if (new Set(values).size !== values.length) error(`${location}/options`, '筛选按钮组选项的 value 不得重复');
    if (declaration.default?.length !== 1 || !values.includes(declaration.default[0]!)) error(`${location}/filterId`, '筛选按钮组 default 必须是候选项中的一个值');
    if (page.filters?.some(filter => filterDependencies(filter).includes(declaration.id))) error(`${location}/filterId`, '固定筛选按钮组不能驱动其他筛选器的级联');
    if (!Object.values(page.dataSources).some(source => source.source.type === 'query' && source.source.query.filterBindings?.[declaration.id])) error(location, '筛选按钮组需要至少一个查询通过 filterBindings 消费');
  });
  return errors;
}

/** Old declarations are rejected with a migration hint, never silently reinterpreted. */
export function obsoleteChartFilterErrors(document: unknown): TypedError[] {
  const errors: TypedError[] = [];
  walkDocumentComponents(document, (component, path) => {
    if (['barChart','lineChart','pieChart','mapChart'].includes(String(component.type)) && component.props && typeof component.props === 'object' && 'filter' in component.props) errors.push({type:'SCHEMA_ERROR',path:`${path}/props/filter`,message:'旧图表 props.filter 已移除，请迁移为独立 filterGroup 组件，并保留原 filterId、options、default 和 filterBindings'});
  });
  return errors;
}
