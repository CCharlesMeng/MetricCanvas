import type { BarSeriesOption, LineSeriesOption, EChartsOption, SeriesOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { copyChartOption, type ChartSource } from './chart-option-extension';

const PLACEHOLDER_VALUES = [0.6, 0.85, 0.7, 0.9, 0.55, 0.75];
type Axis = XAXisComponentOption | YAXisComponentOption;

function entries<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function categoryCount(axis: Axis): number {
  return axis.type === 'category' ? axis.data?.length ?? 0 : 0;
}

function loadingAxis<T extends Axis>(axis: T, count: number): T {
  axis.axisLabel = { show: false };
  if (axis.type === 'category' && !axis.data?.length) axis.data = Array.from({ length: count }, () => '');
  return axis;
}

function placeholderValues(count: number, axis: Axis | undefined): number[] {
  const min = typeof axis?.min === 'number' && Number.isFinite(axis.min) ? axis.min : 0;
  const max = typeof axis?.max === 'number' && Number.isFinite(axis.max) ? axis.max : min + 1;
  const span = max > min ? max - min : 1;
  return Array.from({ length: count }, (_, index) => min + span * PLACEHOLDER_VALUES[index % PLACEHOLDER_VALUES.length]!);
}

function valueAxis(series: BarSeriesOption | LineSeriesOption, option: EChartsOption): Axis | undefined {
  const x = entries(option.xAxis)[series.xAxisIndex ?? 0];
  return x?.type === 'value' ? x : entries(option.yAxis)[series.yAxisIndex ?? 0];
}

function loadingSeries(series: SeriesOption, count: number, option: EChartsOption): SeriesOption {
  if (series.type === 'bar' || series.type === 'line') {
    return { ...series, silent: true, label: { show: false },
      data: placeholderValues(count, valueAxis(series, option)) };
  }
  if (series.type === 'pie') {
    return { ...series, silent: true, label: { show: false }, labelLine: { show: false },
      data: [{ value: 1, name: '' }] };
  }
  return { ...series, silent: true };
}

function hasSeriesData(series: SeriesOption): boolean {
  return 'data' in series && Array.isArray(series.data) && series.data.length > 0;
}

/** Screen-only geometry. Query snapshots, field bindings and exports never receive placeholders. */
export function loadingChartOption(option: EChartsOption): EChartsOption {
  const copied = copyChartOption(option);
  const series = entries(copied.series);
  if (series.some(hasSeriesData)) return { ...copied, animation: false, tooltip: { show: false },
    series: series.map(item => ({ ...item, silent: true })) };
  const axes: Axis[] = [...entries(copied.xAxis), ...entries(copied.yAxis)];
  const count = Math.max(0, ...axes.map(categoryCount)) || 6;
  return { ...copied, animation: false, tooltip: { show: false },
    ...(copied.xAxis ? { xAxis: entries(copied.xAxis).map(axis => loadingAxis(axis, count)) } : {}),
    ...(copied.yAxis ? { yAxis: entries(copied.yAxis).map(axis => loadingAxis(axis, count)) } : {}),
    series: entries(copied.series).map(series => loadingSeries(series, count, copied)) };
}

export function loadingChartSource(source: ChartSource): ChartSource {
  return { ...source,
    base: source.base ? loadingChartOption(source.base) : undefined,
    extended: source.extended ? loadingChartOption(source.extended) : undefined };
}
