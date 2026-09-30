import type { Page } from '@metriccanvas/page';
import { validateCalendarTimeRange, validateTimePointValue, type OpenDetailAction, type Row } from '@metriccanvas/page/internal';
import type { FilterValues, FilterValue } from './filter-state';
import type { PageParamValues } from './page-params';

/** A query view is a scoped input to the existing orchestrator, never a nested page renderer. */
export function detailViewInput(page: Page, action: OpenDetailAction, row: Row, filters: FilterValues, params: PageParamValues): { page: Page; filters: FilterValues } {
  if (!('view' in action.openDetail)) throw new Error('详情未引用视图');
  const detail = action.openDetail;
  const view = page.detailViews?.find(candidate => candidate.id === detail.view);
  if (!view) throw new Error('详情视图不存在');
  const scoped = new Map(filters);
  for (const id of view.filters ?? []) {
    const declaration = page.filters?.find(filter => filter.id === id);
    const binding = detail.bindings?.[id];
    if (!binding || !declaration) throw new Error('详情参数不完整');
    let value: unknown;
    if (binding.source === 'row') value = row[binding.field];
    else if (binding.source === 'param') {
      value = params.get(binding.id);
      if (value && typeof value === 'object' && !Array.isArray(value) && 'start' in value && 'end' in value) {
        value = declaration.type === 'timePoint' && value.start === value.end ? value.start : { from: value.start, to: value.end };
      }
    }
    else {
      const source = filters.get(binding.id);
      if (source?.type === 'timeRange' && !binding.part) value = source;
      else if (binding.part === 'from' || binding.part === 'to') value = source && 'from' in source ? source[binding.part] : undefined;
      else if (source?.type === 'dimension') value = binding.part === 'level' ? source.level : source.values;
      else if (source && 'value' in source) value = source.value;
    }
    let next: FilterValue;
    if (declaration.type === 'dimension') {
      const values = Array.isArray(value) ? value : [value];
      if (!values.length || values.some(item => !((typeof item === 'string' && item.length > 0) || (typeof item === 'number' && Number.isFinite(item))))) throw new Error('详情维度参数缺失');
      next = { type: 'dimension', dimension: declaration.dimension, values: values.map(String) };
    } else if (declaration.type === 'timePoint') {
      if (typeof value !== 'string' || validateTimePointValue(value, declaration.granularity)) throw new Error('详情日期参数无效');
      next = { type: 'timePoint', granularity: declaration.granularity, value };
    } else if (declaration.type === 'timeRange') {
      const range = value as { from?: unknown; to?: unknown } | undefined;
      if (!range || typeof range.from !== 'string' || typeof range.to !== 'string' || validateCalendarTimeRange({ from: range.from, to: range.to }).length) throw new Error('详情时间范围无效');
      next = { type: 'timeRange', from: range.from, to: range.to };
    } else throw new Error('详情参数类型不支持');
    scoped.set(id, next);
  }
  const dataSources = Object.fromEntries(Object.entries(page.dataSources).map(([id, source]) => [id,
    view.mode === 'query' && source.source.type === 'query'
      ? { ...source, source: { ...source.source, initial: undefined } } : source]));
  return { page: { ...page, dataSources, detailViews: undefined, sectionGroups: undefined,
    defaultSectionGroup: undefined, sectionGroupParam: undefined, sectionAnchors: undefined,
    sections: [{ id: view.id, components: view.components }] }, filters: scoped };
}
