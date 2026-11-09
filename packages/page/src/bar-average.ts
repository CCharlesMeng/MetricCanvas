import type { BarChartProps } from './page';
import type { TypedError } from './errors';

/** Averaging is a declared field-series operation, never a category or source row. */
export function checkBarAverage(props: BarChartProps, path: string, errors: TypedError[]): void {
  props.series.forEach((series, index) => {
    if (!('aggregate' in series) || series.aggregate === undefined) return;
    if (props.stacked || props.variant || series.role !== undefined || series.kind === 'line') {
      errors.push({ type: 'SCHEMA_ERROR', path: `${path}/series/${index}/aggregate`, message: '前端均值仅支持普通柱系列，不支持折线、堆叠或预测' });
    }
  });
}
