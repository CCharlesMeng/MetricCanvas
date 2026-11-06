import type { BarChartProps, ChartSeries, LineChartProps } from '@metriccanvas/page/internal';

export type CartesianChartProps = BarChartProps | LineChartProps;
const projection = Symbol('chart-series-presentation');
interface SeriesProjection { declaration: CartesianChartProps; indices: number[] }
type ProjectedProps = CartesianChartProps & { [projection]?: SeriesProjection };

/** Internal render state; never serialized into the page or used to change queries. */
export function projectChartSeries<T extends CartesianChartProps>(props: T, eligible: (series: ChartSeries) => boolean): T {
  const declaration = chartDeclaration(props);
  if (!declaration.series.some(series => series.visibleWhen)) return props;
  const indices = declaration.series.flatMap((series, index) => eligible(series) ? [index] : []);
  return { ...declaration, series: indices.map(index => declaration.series[index]!), [projection]: { declaration, indices } } as T;
}

export function chartDeclaration<T extends CartesianChartProps>(props: T): T {
  return ((props as ProjectedProps)[projection]?.declaration ?? props) as T;
}

export function chartSeriesIndex(props: CartesianChartProps, index: number): number {
  return (props as ProjectedProps)[projection]?.indices[index] ?? index;
}

export function explicitChartAxes(props: CartesianChartProps): boolean {
  return chartDeclaration(props).series.some(series => 'kind' in series || 'axis' in series);
}

export function chartSeriesAxis(props: CartesianChartProps, index: number): number {
  if (!props.dualAxis) return 0;
  const series = props.series[index]!;
  if (explicitChartAxes(props)) return 'axis' in series && series.axis === 'secondary' ? 1 : 0;
  return chartSeriesIndex(props, index) > 0 ? 1 : 0;
}

/** Keep implicit first-series/remaining-series axis ownership when the first is hidden. */
export function chartAxisFormats<T>(props: CartesianChartProps, formats: T[]) {
  if (chartDeclaration(props) === props || !props.dualAxis) return formats;
  const primary = formats.filter((_, index) => chartSeriesAxis(props, index) === 0);
  const secondary = formats.filter((_, index) => chartSeriesAxis(props, index) === 1);
  return [primary[0], ...secondary];
}

export function chartRoleIndex(props: BarChartProps, index: number): number | undefined {
  const role = props.series[index]!.role;
  if (role === undefined) return undefined;
  return chartDeclaration(props).series.slice(0, chartSeriesIndex(props, index)).filter(series => series.role === role).length;
}
