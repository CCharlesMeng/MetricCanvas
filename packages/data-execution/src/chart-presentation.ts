import { evaluateCondition, projectComponentFields, type Component, type ConditionContext, type Page } from '@metriccanvas/page/internal';
import { projectChartSeries } from './chart-series-presentation';
import { projectPresentationData } from './presentation-data';

type CartesianChart = Extract<Component, { type: 'barChart' | 'lineChart' }>;
export function chartPresentation(page: Page, chart: CartesianChart, context: ConditionContext): CartesianChart {
  const enabled = chart.props.series.some(series => series.visibleWhen !== undefined);
  if (!enabled) return chart;
  const bound = projectComponentFields(page, chart, context.filters) as CartesianChart;
  const props = projectChartSeries(bound.props, series => evaluateCondition(series.visibleWhen, context).status === 'allow');
  return projectPresentationData({ ...bound, props } as CartesianChart, true);
}
