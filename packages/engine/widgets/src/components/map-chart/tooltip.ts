import type { MapChartProps, Row, ValueFormat } from '@metriccanvas/page/internal';
import { formatChartNumber } from '../../shared/chart-option';
import { resolveComponentValue, type ResolvedComponentValue } from '../../shared/component-value';
import { valueColor, valueColorStyle } from '../../shared/value-color';
import type { MainDataSlots } from '../../shared/component-data';

/** 已解析的 tooltip 追加项:标签 + 字段名 + 该绑定最终生效的展示格式。 */
export interface MapTooltipField {
  label: string;
  field?: string;
  read?: (row?: Row) => import('@metriccanvas/page/internal').FieldValue | undefined;
  format?: ValueFormat;
  missingText?: string;
  unit?: string;
}

export interface MapTooltipRow {
  label: string;
  value: string;
}

/** 数据行 → tooltip 的「标签 + 取值」序列;缺失取值走 `formatValue` 的空值文本。 */
export function mapTooltipRows(
  row: Row | undefined,
  fields: readonly MapTooltipField[]
): MapTooltipRow[] {
  return fields.map((entry) => ({
    label: entry.label,
    value: formatChartNumber(entry.read ? entry.read(row) : row?.[entry.field ?? ''], entry.format ?? 'number', entry.missingText, entry.unit)
  }));
}

/**
 * tooltip 标记文本。ECharts 的 `formatter` 返回值按 HTML 渲染,而这里的标题与
 * 取值都来自数据,所以逐个转义——数据里的 `<` 不该变成标签。
 */
export function mapTooltipMarkup(title: string, rows: readonly MapTooltipRow[]): string {
  const body = rows
    .map(
      (row) =>
        `<div>${escapeText(row.label)}：<b>${escapeText(row.value)}</b></div>`
    )
    .join('');
  return `<div><b>${escapeText(title)}</b></div>${body}`;
}

type TooltipComparison = NonNullable<NonNullable<MapChartProps['tooltipRows']>[number]['comparison']>;
const changeColors = { mode: 'sign', positive: 'green', negative: 'red' } as const;

export function groupedMapTooltip(
  declarations: NonNullable<MapChartProps['tooltipRows']>,
  data: MainDataSlots,
  emptyBehavior: MapChartProps['emptyBehavior']
) {
  const rows = declarations.map(({ label, field, comparison }) => ({
    metric: resolveTooltipMetric({ label, field }, data, emptyBehavior),
    comparison: comparison && resolveTooltipMetric(comparison, data, emptyBehavior)
  }));
  return (title: string, row: Row) => {
    const heading = `<div data-map-tooltip-heading style="font-size:18px;line-height:26px;font-weight:700;margin-bottom:6px;color:#192f43">${escapeText(title)}</div>`;
    return heading + rows.map(({ metric, comparison }) =>
      `<div data-map-tooltip-row style="min-height:24px;white-space:nowrap">${groupedMetricMarkup(metric, row)}${comparison ? groupedMetricMarkup(comparison, row, true) : ''}</div>`
    ).join('');
  };
}

function resolveTooltipMetric(binding: TooltipComparison, data: MainDataSlots, emptyBehavior: MapChartProps['emptyBehavior']) {
  return { ...resolveComponentValue(binding, data, emptyBehavior), label: binding.label };
}

function groupedMetricMarkup(metric: ResolvedComponentValue, row: Row, comparison = false) {
  const raw = metric.read(row);
  const value = formatChartNumber(raw, metric.format, metric.missingText, metric.unit);
  const isChange = comparison || (typeof metric.format === 'string' && metric.format.endsWith('-signed'));
  const color = isChange ? valueColorStyle(valueColor(raw, changeColors, metric.format)) ?? '#000' : '#000';
  const margin = comparison ? '12px' : '0';
  return `<span style="margin-left:${margin}">${escapeText(metric.label)} <b style="color:${color}">${escapeText(value)}</b></span>`;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
