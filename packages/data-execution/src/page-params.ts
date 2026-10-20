import { timeFilterBoundaryError, periodSelectionFromRange } from '@metriccanvas/page/internal';
import { validateTimePointValue, matchesParamDeclaration, materializePageParams } from '@metriccanvas/page/internal';
import type { PageParamValue } from '@metriccanvas/page/internal';
type PageParamValues = ReadonlyMap<string, PageParamValue>;

/** 运行态副本：参数只写入未受筛选控制的查询目标及筛选初值，模板不变。 */
export function initializePageParams(page: import('@metriccanvas/page').Page, values: PageParamValues): import('@metriccanvas/page').Page {
  // Resolve every accepted version at the same boundary, before initial rows or queries are exposed.
  page = materializePageParams(page, values);
  return seedPageParamFilters(page, values);
}

/** Seed an already materialized page without resolving its query bindings twice. */
export function seedPageParamFilters(page: import('@metriccanvas/page').Page, values: PageParamValues): import('@metriccanvas/page').Page {
  for (const declaration of page.params ?? []) {
    const value = values.get(declaration.id);
    if ((value === undefined && declaration.required !== false) || (value !== undefined && !matchesParamDeclaration(value, declaration))) throw new Error(`参数取值缺失或类型错误:${declaration.id}`);
  }
  const initialized = structuredClone(page);
  for (const declaration of initialized.filters ?? []) {
    if (declaration.type !== 'dimension' && declaration.type !== 'timePoint' && declaration.type !== 'timeRange') continue;
    if (!declaration.initialParam) continue;
    const value = values.get(declaration.initialParam);
    if (declaration.type === 'dimension') {
      declaration.default = value === undefined ? [] : Array.isArray(value) ? [...value] : [String(value)];
      if ((declaration.selection === 'single' || declaration.display === 'tabs') && declaration.default.length > 1) throw new Error(`筛选器 ${declaration.id}: 单选参数最多允许一个值`);
    } else if (declaration.type === 'timeRange') {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const range = {from:value.start,to:value.end};
        if (declaration.display === 'period') {
          const selection = periodSelectionFromRange(range,declaration.initialMode ?? 'month',declaration.precision === 'month' ? 'month' : 'date');
          if (!selection) throw new Error(`筛选器 ${declaration.id}: 参数不是完整自然期间`);
          const error = timeFilterBoundaryError(declaration, {type:'timeRange',...range,selection});
          if (error) throw new Error(`筛选器 ${declaration.id}: ${error}`);
          declaration.default = selection;
        } else {
          const error = timeFilterBoundaryError(declaration, {type:'timeRange',...range});
          if (error) throw new Error(`筛选器 ${declaration.id}: ${error}`);
          declaration.default = range;
        }
      }
    } else if (declaration.type === 'timePoint') {
      // 单点 times 输入的两端相同，取哪一端都一样；缺值时不写初值＝不筛。
      const point = value as { start?: string } | undefined;
      if (typeof point?.start === 'string') {
        const issue = validateTimePointValue(point.start, declaration.granularity, declaration.min, declaration.disableFuture !== false);
        if (issue) throw new Error(`筛选器 ${declaration.id}: ${issue}`);
        declaration.default = point.start;
      }
      else delete declaration.default;
    }
  }
  return initialized;
}
