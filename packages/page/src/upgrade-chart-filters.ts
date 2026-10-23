import { walkDocumentComponents } from './component-walk';
import { filterGroupComponentZ } from './schema/components/filter-group';
import type { TypedError } from './errors';
import { migrationError, object, type JsonObject, type MigrationChange } from './upgrade-types';

function uniqueId(base: string, ids: Set<string>): string {
  let id = base;
  let suffix = 1;
  while (ids.has(id)) id = `${base}-${suffix++}`;
  ids.add(id);
  return id;
}

function chartControl(component: JsonObject, ids: Set<string>): JsonObject {
  return { id: uniqueId(`${component.id}-filter`, ids), type: 'filterGroup', layout: { span: 12 }, props: object(component.props)!.filter };
}

function convertChart(component: JsonObject, path: string, ids: Set<string>, changes: MigrationChange[]): TypedError[] {
  const props = object(component.props)!;
  const control = chartControl(component, ids);
  if (!filterGroupComponentZ.safeParse(control).success) return [migrationError(`${path}/props/filter`, '旧筛选声明需要有效的 filterId 和固定 options；保留原声明并修复后重试')];
  if (path.includes('/props/components/')) return [migrationError(`${path}/props/filter`, '组合卡内旧图表筛选需在同一卡内显式拆成 filterGroup 与图表，自动包装会产生禁止的嵌套组合卡')];
  if (path.startsWith('/detailViews/')) return [migrationError(`${path}/props/filter`, '旧图表筛选不支持详情视图，不能自动迁移')];
  const chart = { ...component, props: { ...props }, layout: { span: 12 } };
  delete chart.props.filter;
  const wrapper = {
    id: uniqueId(`${component.id}-group`, ids), type: 'compositeCard', layout: component.layout,
    props: { components: [control, chart] }
  };
  // Visibility belongs to the same group as before; chart identity and references remain stable.
  for (const key of ['visible', 'visibleWhen']) if (key in component) Object.assign(wrapper, { [key]: component[key] });
  for (const key of Object.keys(component)) delete component[key];
  Object.assign(component, wrapper);
  changes.push({ rule: 'chart-filter', path, message: '旧图表筛选迁移为组合卡中的 filterGroup 与原图表；保留图表 id、外部跨度、筛选默认值和查询绑定' });
  return [];
}

export function upgradeChartFilters(document: JsonObject, changes: MigrationChange[]): TypedError[] {
  const ids = new Set<string>();
  const charts: Array<{ component: JsonObject; path: string }> = [];
  walkDocumentComponents(document, (component, path) => {
    if (typeof component.id === 'string') ids.add(component.id);
    if (['barChart', 'lineChart', 'pieChart', 'mapChart'].includes(String(component.type)) && object(component.props) && 'filter' in object(component.props)!) charts.push({ component, path });
  });
  return charts.flatMap(({ component, path }) => convertChart(component, path, ids, changes));
}
