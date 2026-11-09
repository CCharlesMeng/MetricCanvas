import type { BarChartProps } from '@metriccanvas/page/internal';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveComponentValue } from '../../shared/component-value';
import { finiteNumber } from '../../shared/value-format';

function arithmeticMean(values: Array<number | undefined>): number | null {
  const valid = values.filter(value => value !== undefined);
  if (!valid.length) return null;
  const total = valid.reduce((sum, value) => sum + value, 0);
  if (Number.isFinite(total)) return total / valid.length;
  // Avoid overflowing a sum of otherwise finite inputs.
  return valid.reduce((mean, value, index) => mean * (index / (index + 1)) + value / (index + 1), 0);
}

/** A declared average series preserves category identity and presentation metadata. */
export function resolveBarSeriesValue(series: BarChartProps['series'][number], data: MainDataSlots, emptyBehavior?: BarChartProps['emptyBehavior']) {
  const field = resolveComponentValue(series, data, emptyBehavior);
  if (!('aggregate' in series) || series.aggregate !== 'avg') return field;
  const mean = arithmeticMean(data.main.snapshot.rows.map(row => finiteNumber(field.read(row))));
  return { ...field, read: () => mean };
}
