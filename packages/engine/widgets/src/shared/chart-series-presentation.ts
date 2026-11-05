import type { EChartsOption } from 'echarts';
import { chartDeclaration, chartSeriesIndex, explicitChartAxes, type CartesianChartProps } from '../../../runtime/src/chart-series-state';
import { chartSource, type ChartDiagnostic, type ChartSource } from './chart-option-extension';
import { CHART_PALETTE } from './chart-option';
import type { ColorList } from './chart-palette';

/** Validate patches against the declaration, then map them to surviving series. */
export function cartesianChartSource(build: () => EChartsOption, props: CartesianChartProps, diagnostic: ChartDiagnostic, order: readonly number[]): ChartSource {
  const source = chartSource(build, chartDeclaration(props), diagnostic, order.map(index => chartSeriesIndex(props, index)));
  if (chartDeclaration(props) === props) return source;
  return { ...source,
    base: source.base && reconcileChartSeries(source.base, props),
    extended: source.extended && reconcileChartSeries(source.extended, props)
  };
}

/** A surviving series retains its declared palette slot when a preceding one disappears. */
export function chartSeriesColor(props: CartesianChartProps, index: number, palette?: ColorList) {
  if (chartDeclaration(props) === props) return undefined;
  const colors = props.echartsOption?.color;
  const list = Array.isArray(colors) && colors.every(color => typeof color === 'string') ? colors : palette ?? CHART_PALETTE;
  return list[chartSeriesIndex(props, index) % list.length];
}

/** The engine owns eligibility even when a presentation patch names hidden legend entries or axes. */
export function reconcileChartSeries(option: EChartsOption, props: CartesianChartProps): EChartsOption {
  const series = (Array.isArray(option.series) ? option.series : []) as Array<{ name?: string | number; xAxisIndex?: number; yAxisIndex?: number }>;
  const names = new Set(series.map(item => item.name));
  const legend = option.legend && !Array.isArray(option.legend) ? option.legend : {};
  const data = legend.data?.filter(item => names.has(typeof item === 'string' ? item : item.name)) ?? series.map(item => String(item.name ?? ''));
  const key = 'horizontal' in props && props.horizontal && !explicitChartAxes(props) ? 'xAxis' : 'yAxis';
  const value = option[key];
  const axes = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const used = new Set(series.map(item => key === 'xAxis' ? item.xAxisIndex ?? 0 : item.yAxisIndex ?? 0));
  const projected = axes.map((axis, index) => {
    if (!used.has(index)) return { ...axis, show: false, name: '', splitLine: { show: false } };
    if (used.size === 1 && index > 0) return { ...axis, alignTicks: false, splitLine: { ...axis.splitLine, show: true } };
    return axis;
  });
  return { ...option, legend: { ...legend, ...(data ? { data } : {}), ...(series.length ? {} : { show: false }) },
    [key]: Array.isArray(value) ? projected : projected[0] };
}
