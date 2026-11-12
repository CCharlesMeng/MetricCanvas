/** Observe the actual option builders and formatter, without rendering/DOM or result inference. */
import type { BarChartProps, LineChartProps } from '../packages/page/src/internal';
import { barOption } from '../packages/engine/widgets/src/components/bar-chart/options';
import { lineOption } from '../packages/engine/widgets/src/components/line-chart/options';
import { resolveComponentValue } from '../packages/engine/widgets/src/shared/component-value';
import type { MainDataSlots } from '../packages/engine/widgets/src/shared/component-data';
import { formatValue } from '../packages/engine/widgets/src/shared/value-format';
import { chartAxisField, numericAxisPresentation } from '../packages/engine/widgets/src/shared/chart-axis-presentation';

type Surface = { actual: string | null; expected: string; matches: boolean | null };
function observed(actual: string | null, expected: string): Surface {
  return { actual, expected, matches: actual === null ? null : actual === expected };
}

/** Structural options from real builders, not a second formatter. */
function axisIndex(props: BarChartProps | LineChartProps, index: number): number {
  const explicit = props.series.some(series => 'axis' in series && series.axis !== undefined || 'kind' in series && series.kind !== undefined);
  const entry = props.series[index];
  if (explicit) return entry && 'axis' in entry && entry.axis === 'secondary' ? 1 : 0;
  return props.dualAxis && index > 0 ? 1 : 0;
}

export function chartPresentationProbes(type: 'barChart' | 'lineChart', props: BarChartProps | LineChartProps, data: MainDataSlots) {
  const option = type === 'barChart' ? barOption(data, props as BarChartProps) : lineOption(data, props as LineChartProps);
  const axisOption = type === 'barChart' && (props as BarChartProps).horizontal ? option.xAxis : option.yAxis;
  const axes = (Array.isArray(axisOption) ? axisOption : [axisOption]) as Array<{ name?: string; axisLabel?: { formatter?: (value: number) => string } }>;
  const series = option.series as Array<{ label?: { formatter?: (value: unknown) => string }; tooltip?: { valueFormatter?: (value: unknown) => string } }>;
  const axisFields = props.series.map(entry => chartAxisField(resolveComponentValue(entry, data), data.main.snapshot.rows, entry.unit));
  return props.series.map((entry, index) => {
    const resolved = resolveComponentValue(entry, data);
    const value = 1000000;
    const expected = formatValue(value, resolved.format);
    const actual = series[index];
    const axis = axes[axisIndex(props, index)];
    const expectedAxis = numericAxisPresentation(axisFields.filter((_, fieldIndex) => axisIndex(props, fieldIndex) === axisIndex(props, index)));
    return { index, format: resolved.format, axis: observed(axis?.axisLabel?.formatter?.(value) ?? null, expectedAxis.axisLabel.formatter(value)),
      unit: { actual: axis?.name, expected: expectedAxis.name, matches: axis?.name === expectedAxis.name },
      label: observed(actual?.label?.formatter?.({ value }) ?? null, expected),
      tooltip: observed(actual?.tooltip?.valueFormatter?.(value) ?? null, expected) };
  });
}
