import { format } from 'echarts/core';
import type { TooltipComponentOption } from 'echarts';
import type { ColorRule } from '@metriccanvas/page/internal';
import { formatChartNumber, formatterValue } from './chart-option';
import type { ResolvedComponentValue } from './component-value';
import { valueColor, valueColorStyle } from './value-color';

interface SeriesTooltipEntry {
  field: Pick<ResolvedComponentValue, 'format' | 'missingText' | 'unit'>;
  series: { unit?: string; tooltip?: { colorRule: ColorRule } };
}

type Formatter = Exclude<NonNullable<TooltipComponentOption['formatter']>, string>;
type TooltipPoint = Exclude<Parameters<Formatter>[0], unknown[]> & { axisValueLabel?: string };

export function seriesTooltipValue({ field, series }: SeriesTooltipEntry, value: unknown): string {
  return formatChartNumber(formatterValue(value), field.format, field.missingText, field.unit, series.unit);
}

function tooltipRow(point: TooltipPoint, entry: SeriesTooltipEntry): string {
  const rule = entry.series.tooltip?.colorRule;
  const color = rule && valueColorStyle(valueColor(formatterValue(point.value), rule, entry.field.format));
  const colorStyle = color ? `color:${color};` : '';
  const marker = typeof point.marker === 'string' ? point.marker : '';
  const name = format.encodeHTML(point.seriesName ?? '');
  const value = format.encodeHTML(seriesTooltipValue(entry, point.value));
  return `<div style="margin-top:4px">${marker}${name}<span data-tooltip-value style="float:right;margin-left:20px;font-weight:700;${colorStyle}">${value}</span><div style="clear:both"></div></div>`;
}

function coloredTooltipMarkup(points: TooltipPoint[], entries: readonly SeriesTooltipEntry[]): string {
  const first = points[0];
  if (!first) return '';
  const title = format.encodeHTML(first.axisValueLabel ?? first.name);
  const rows = points.map(point => {
    const entry = entries[point.seriesIndex ?? -1];
    return entry ? tooltipRow(point, entry) : '';
  });
  return `<div role="tooltip">${title}${rows.join('')}</div>`;
}

export function chartTooltip(
  entries: readonly SeriesTooltipEntry[],
  advancedTooltip: unknown,
  options: Pick<TooltipComponentOption, 'hideDelay'> = {}
): TooltipComponentOption {
  const base: TooltipComponentOption = { trigger: 'axis', confine: true, ...options };
  const renderMode = (advancedTooltip as { renderMode?: unknown } | null | undefined)?.renderMode;
  if (renderMode === 'richText' || !entries.some(entry => entry.series.tooltip)) return base;
  return {
    ...base,
    formatter: params => coloredTooltipMarkup(Array.isArray(params) ? params : [params], entries)
  };
}
