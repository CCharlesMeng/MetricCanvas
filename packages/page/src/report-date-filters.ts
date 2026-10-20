import {ordinaryQuery} from './time-mode';
import { isPeriodSelection, resolvePeriodSelection } from './period-filter';
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
    const buttons = component.props.exportButtons;
    if (buttons) {
      if (component.props.pdfExport || component.props.pngExport) error(`${path}/props/exportButtons`, 'exportButtons 不能与旧 pdfExport/pngExport 混用');
      if (page.layout === 'dashboard' || !/^\/sections\/\d+\/components\/\d+$/.test(path)) error(`${path}/props/exportButtons`, '导出按钮只允许放在报表的顶层页头');
      if (new Set(buttons.map(button => button.format)).size !== buttons.length) error(`${path}/props/exportButtons`, '每种格式只能配置一个导出按钮');
    }
    if (component.props.pdfExport && (page.layout === 'dashboard' || !/^\/sections\/\d+\/components\/\d+$/.test(path))) {
      error(`${path}/props/pdfExport`, 'PDF 下载工具带只允许放在报表的顶层页头');
    }
    if (component.props.pngExport && (page.layout === 'dashboard' || !/^\/sections\/\d+\/components\/\d+$/.test(path))) {
      error(`${path}/props/pngExport`, '导出图片只允许放在报表的顶层页头');
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
    if (filter.type === 'timeRange') {
      const path = `/filters/${index}`;
      if (filter.display === 'period') {
        if (page.layout !== 'dashboard' && !page.iocHeader?.filterIds?.includes(filter.id)) error(path, '期间筛选仅支持 Dashboard 顶部筛选或 IOC 页头');
        if (filter.precision === 'datetime') error(path, '期间筛选不支持 datetime');
        if (!filter.initialParam && !isPeriodSelection(filter.default)) error(`${path}/default`, '期间筛选需要期间默认选择或参数初值');
        if (filter.initialParam && !filter.initialMode) error(`${path}/initialMode`, '参数初始化期间筛选必须显式声明模式');
        if (filter.initialMode && !filter.initialParam) error(`${path}/initialMode`, 'initialMode 只用于参数初始化');
        if (filter.periodModes) {
          if (new Set(filter.periodModes).size !== filter.periodModes.length) error(`${path}/periodModes`, '期间模式不能重复');
          if (isPeriodSelection(filter.default) && !filter.periodModes.includes(filter.default.mode)) error(`${path}/default/mode`, '默认期间模式必须在 periodModes 中');
          if (filter.initialMode && !filter.periodModes.includes(filter.initialMode)) error(`${path}/initialMode`, '参数初始化期间模式必须在 periodModes 中');
        }
        if (isPeriodSelection(filter.default)) { try { resolvePeriodSelection(filter.default,new Date(2026,0,1),filter.precision === 'month' ? 'month' : 'date'); } catch { error(`${path}/default`,'期间默认选择不合法'); } }
      } else if (isPeriodSelection(filter.default) || filter.initialMode || filter.periodModes) error(path,'期间选择只能用于 display=period');
    }
    if (filter.required && filter.default === undefined && !filter.initialParam && !filter.availability?.initial && !(filter.type==='timeRange'&&filter.display==='modes')) error(`/filters/${index}`, '必需日期筛选器需要 default 或 initialParam 初值');
    if (filter.type === 'timeRange' && filter.display !== 'period' && filter.precision === 'month' && filter.default !== undefined &&
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
      const time = ordinaryQuery(query).body.dsl_list[0].filter;
      const value = time && typeof time === 'object' && !Array.isArray(time) ? time.time : undefined;
      const config = value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
      const path = `/dataSources/${id}/source/query/filterBindings/${filterId}`;
      if (declaration?.type === 'timeRange' && declaration.display === 'period') {
        if (!config || config.period !== (declaration.precision === 'month' ? 'month' : 'day')) error(path,'期间筛选需要精度匹配的查询时间配置');
        if (config && ('start' in config || 'end' in config || 'param' in config)) error(path,'期间筛选不能另有固定时间来源');
      }
      if (binding.window && declaration?.type === 'timePoint') {
        if (!timeWindowCompatible(declaration.granularity, binding.window)) error(path, '时间窗口单位与筛选器精度不相容');
        if (!config || config.period !== (declaration.granularity === 'month' ? 'month' : 'day')) error(path, '时间窗口需要精度匹配的显式 filter.time.period');
        if (config && ('start' in config || 'end' in config || 'param' in config)) error(path, '筛选时间窗口不能另有固定时间来源');
      } else if (declaration?.type === 'timeRange' && declaration.precision === 'month' && config?.period !== 'month') error(path, '月份范围需要查询 period=month');
    }
  }
  return errors;
}
