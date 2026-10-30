import type { CategoryLabels, ValueFormatPreset } from '@metriccanvas/page/internal';
import { format, type EChartsOption, type GridComponentOption, type LegendComponentOption, type LabelLayoutOptionCallbackParams } from 'echarts';
import { finiteNumber } from './value-format';
import { formatterValue, formatChartNumber } from './chart-option';

export function categoryLabelOption(labels?: CategoryLabels, showValues = false) {
  if (!labels && !showValues) return {};
  return { axisLabel: {
    ...(labels?.mode === 'all' ? { interval: 0, hideOverlap: false, showMinLabel: true, showMaxLabel: true } : {}),
    ...(labels?.rotate !== undefined ? { rotate: labels.rotate } : {}),
    ...(showValues ? { margin: 26 } : {})
  } };
}

export function pointValueLabel(valueFormat?: ValueFormatPreset, missingText?: string) {
  return {
    show: true, position: 'top' as const, distance: 5, color: '#191919', fontSize: 11,
    formatter: (params: unknown) => {
      const value = finiteNumber(formatterValue(params));
      return value === undefined ? '' : formatChartNumber(value, valueFormat, missingText);
    }
  };
}

export const VALUE_LABEL_LAYOUT = { hideOverlap: false };

/** Keep dense labels at their own bar end/node; never move them into distant lanes. */
export function valueLabelLayout(values: Array<number | null | undefined>, line = false, horizontal = false) {
  if (values.length <= 20 || horizontal) return VALUE_LABEL_LAYOUT;
  return (params: LabelLayoutOptionCallbackParams) => {
    const below = !line && (values[params.dataIndex ?? 0] ?? 0) < 0;
    return { hideOverlap: false, verticalAlign: 'middle' as const, align: 'center' as const,
      x: params.rect.x + params.rect.width / 2,
      y: below ? params.rect.y + params.rect.height + 10 : params.rect.y - 10 };
  };
}

/** Geometry only. Uses ECharts text metrics and the current drawing box, never business metadata. */
export function cartesianFrame(option: EChartsOption, width: number, expand: boolean, height = 0): { option: EChartsOption; minHeight: number | undefined } {
  const grid = first(option.grid) ?? {};
  const legend = first(option.legend);
  const series = option.series ? (Array.isArray(option.series) ? option.series : [option.series]) : [];
  const legendNames = [...new Set((legend?.data ?? series.map(item => item.name))
    .map(item => typeof item === 'string' ? item : item && typeof item === 'object' ? item.name : undefined)
    .filter((name): name is string => typeof name === 'string'))];
  const legendHeight = legend && legend.show !== false ? legendRows(legend, legendNames, width) * 24 : 0;
  const numericAxes = [...array(option.xAxis), ...array(option.yAxis)].filter(axis => axis.type !== 'category');
  const axisNameSpace = numericAxes.some(axis => axis.name) ? 20 : 0;
  const top = Math.max(number(grid.top, height), legendHeight + axisNameSpace + (expand ? 24 : 8));
  const categories = [...array(option.xAxis), ...array(option.yAxis)].filter(axis => axis.type === 'category');
  let labelSpace = 28;
  for (const axis of categories) {
    const rotate = Math.abs(axis.axisLabel?.rotate ?? 0) * Math.PI / 180;
    const longest = Math.max(0, ...('data' in axis ? axis.data ?? [] : []).map(item => textWidth(
      typeof item === 'object' && item !== null && 'value' in item ? String(item.value) : String(item))));
    labelSpace = Math.max(labelSpace, Math.ceil(longest * Math.sin(rotate) + 12 * Math.cos(rotate) + (axis.axisLabel?.margin ?? 8) + 12));
  }
  const fittedGrid: GridComponentOption = { ...grid, top,
    ...(expand ? { left: Math.max(number(grid.left, width), 24), right: Math.max(number(grid.right, width), 36,
      ...array(option.xAxis).map(axis => axis.name ? textWidth(String(axis.name)) + 20 : 0)) } : {}) };
  return {
    option: { ...option, grid: fittedGrid },
    minHeight: expand ? top + Math.max(220, ...array(option.yAxis).map(axis => axis.type === 'category' ? (axis.data?.length ?? 0) * 18 : 0)) + labelSpace + number(grid.bottom, height) : undefined
  };
}

function textWidth(text: string) { return format.getTextRect(text, '12px sans-serif').width; }
function number(value: unknown, size: number) { return typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.\d+)?%$/.test(value) ? parseFloat(value) * size / 100 : 0; }
function array<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function first<T>(value: T | T[] | undefined): T | undefined { return array(value)[0]; }

function legendRows(legend: LegendComponentOption, names: string[], width: number) {
  if (legend.type === 'scroll') return 1;
  const available = Math.max(80, width - 32);
  let rows = 1, used = 0;
  for (const name of names) {
    const item = (legend.itemWidth ?? 25) + 5 + textWidth(name) + (legend.itemGap ?? 10);
    if (used > 0 && used + item > available) { rows += 1; used = 0; }
    used += item;
  }
  return rows;
}
