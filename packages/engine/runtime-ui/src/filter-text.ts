import {
  applyFilterTextValues, formatPeriod,
  type FilterTextValueUsage, type FilterTextValueReference, type Page
} from '@metriccanvas/page/internal';
import type { FilterValues } from '../../runtime/src';
import { formatValue } from '../../widgets/src/shared/value-format';

/** 同一文本投影供页面呈现与导出捕获使用，读取已应用状态而非输入草稿。 */
export function filterTextPage(page: Page, usages: readonly FilterTextValueUsage[], values: FilterValues): Page {
  return applyFilterTextValues(page, usages, reference => filterText(reference, values));
}

export function filterText(reference: FilterTextValueReference, values: FilterValues): string {
  const value = values.get(reference.filter);
  if (!value) return reference.format === 'period' ? '全部期间' : '—';
  switch (value.type) {
    case 'timePoint': return formatValue(value.value, reference.format);
    case 'timeRange': return formatPeriod({ start: value.from, end: value.to });
    case 'dimension': return value.values.length ? value.values.join('、') : '—';
    case 'boolean': return formatValue(value.value, reference.format);
    case 'search': return value.query ? formatValue(value.query, reference.format) : '—';
    case 'numberRange': {
      const from = value.from === undefined ? undefined : formatValue(value.from, reference.format);
      const to = value.to === undefined ? undefined : formatValue(value.to, reference.format);
      return from === undefined ? (to === undefined ? '—' : `≤ ${to}`) :
        to === undefined ? `≥ ${from}` : from === to ? from : `${from} 至 ${to}`;
    }
  }
}
