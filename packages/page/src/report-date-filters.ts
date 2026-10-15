import type { Page } from './page';
import type { TypedError } from './errors';
import { walkPageComponents } from './component-walk';
import { timeWindowCompatible } from './time-param';

/** Header references own placement only; all query ownership stays in filterBindings. */
export function reportDateFilterErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const error = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  const filters = new Map((page.filters ?? []).map(f => [f.id, f]));
  const placed = new Set<string>();
  walkPageComponents(page, (component, path) => {
    if (component.type !== 'reportHeader') return;
    if (component.props.pdfExport && (page.layout === 'dashboard' || !/^\/sections\/\d+\/components\/\d+$/.test(path))) {
      error(`${path}/props/pdfExport`, 'PDF 下载工具带只允许放在报表的顶层页头');
    }
    if (!component.props.filterIds) return;
    if (page.layout === 'dashboard' || !/^\/sections\/\d+\/components\/\d+$/.test(path)) {
      error(`${path}/props/filterIds`, '日期工具带只允许放在报表的顶层页头');
    }
    for (const [index, id] of component.props.filterIds.entries()) {
      const ref = `${path}/props/filterIds/${index}`;
      const filter = filters.get(id);
      if (!filter || (filter.type !== 'timePoint' && filter.type !== 'timeRange')) error(ref, '页头只能引用已声明的日期筛选器');
      else if (filter.visible === false) error(ref, '页头日期筛选器不能声明为隐藏');
      if (placed.has(id)) error(ref, '一个日期筛选器只能在一个页头出现一次');
      placed.add(id);
    }
  });
  for (const [index, filter] of (page.filters ?? []).entries()) {
    if (filter.type !== 'timePoint' && filter.type !== 'timeRange') continue;
    if (filter.required && filter.default === undefined && !filter.initialParam) error(`/filters/${index}`, '必需日期筛选器需要 default 或 initialParam 初值');
    if (filter.type === 'timeRange' && filter.precision === 'month' && filter.default !== undefined &&
      (typeof filter.default === 'string' || !('from' in filter.default))) error(`/filters/${index}/default`, '月份范围使用显式 YYYY-MM 起止值');
  }
  for (const [id, source] of Object.entries(page.dataSources)) {
    if (source.source.type !== 'query') continue;
    const query = source.source.query;
    const times = Object.entries(query.filterBindings ?? {}).filter(([, b]) => b.target === 'time');
    if (times.length > 1) error(`/dataSources/${id}/source/query/filterBindings`, '查询时间目标只能由一个筛选器控制');
    for (const [filterId, binding] of times) {
      if (binding.target !== 'time') continue;
      const declaration = filters.get(filterId);
      const time = query.body.dsl_list[0].filter;
      const value = time && typeof time === 'object' && !Array.isArray(time) ? time.time : undefined;
      const config = value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
      const path = `/dataSources/${id}/source/query/filterBindings/${filterId}`;
      if (binding.window && declaration?.type === 'timePoint') {
        if (!timeWindowCompatible(declaration.granularity, binding.window)) error(path, '时间窗口单位与筛选器精度不相容');
        if (!config || config.period !== (declaration.granularity === 'month' ? 'month' : 'day')) error(path, '时间窗口需要精度匹配的显式 filter.time.period');
        if (config && ('start' in config || 'end' in config || 'param' in config)) error(path, '筛选时间窗口不能另有固定时间来源');
      } else if (declaration?.type === 'timeRange' && declaration.precision === 'month' && config?.period !== 'month') error(path, '月份范围需要查询 period=month');
    }
  }
  return errors;
}
