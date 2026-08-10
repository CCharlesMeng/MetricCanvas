import type { BarChartProps } from '@metriccanvas/page';
import type { EChartsOption } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { finiteNumber, formatValue } from '../../shared/value-format';
import { GRID, dualOrSingleAxis, formatterValue } from '../../shared/chart-option';

const BAR_BUSINESS_COLORS = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452'
] as const;

/**
 * 已解析命名数据槽 + 柱状图 props → ECharts option 的纯翻译。
 * 标签继承字段契约;最终格式由组件字段绑定覆盖 defaultFormat 展示建议。
 */
export function barOption(data: MainDataSlots, props: BarChartProps): EChartsOption {
  const rows = data.main.snapshot.rows;
  const category = resolveField(props.categoryField, data);
  const categories = rows.map((row) =>
    formatValue(row[category.field], category.format)
  );
  const categoryAxis = { type: 'category' as const, data: categories };
  const valueAxis = dualOrSingleAxis(props.dualAxis, props.series.length);
  const roleIndexes = { actual: 0, forecast: 0 };
  return {
    grid: GRID,
    tooltip: { trigger: 'axis', confine: true },
    ...(props.series.length > 1 ? { legend: { top: 0, left: 0 } } : {}),
    // 横向条形:类目轴与数值轴对调(覆盖存量两个水平条形组件的场景)
    xAxis: props.horizontal ? valueAxis : categoryAxis,
    yAxis: props.horizontal ? categoryAxis : valueAxis,
    series: props.series.map((series, i) => {
      const field = resolveField(series.field, data);
      const roleIndex = series.role === undefined ? undefined : roleIndexes[series.role]++;
      const roleColor =
        roleIndex === undefined
          ? undefined
          : BAR_BUSINESS_COLORS[roleIndex % BAR_BUSINESS_COLORS.length];
      const itemStyle = {
        ...(props.rounded ? { borderRadius: roundedCorners(props) } : {}),
        ...(series.role === 'actual' ? { color: roleColor } : {}),
        ...(series.role === 'forecast'
          ? {
              color: roleColor,
              opacity: 0.35,
              borderColor: roleColor,
              borderType: 'dashed' as const,
              borderWidth: 1
            }
          : {})
      };
      return {
        name: series.label ?? field.definition?.label ?? field.field,
        type: 'bar' as const,
        ...(props.stacked ? { stack: 'total' } : {}),
        ...(props.dualAxis && i > 0 ? { yAxisIndex: 1 } : {}),
        ...(Object.keys(itemStyle).length > 0 ? { itemStyle } : {}),
        ...(series.role === 'forecast'
          ? {
              lineStyle: {
                color: roleColor,
                opacity: 0.35,
                type: 'dashed' as const,
                width: 1
              }
            }
          : {}),
        ...(field.format
          ? {
              tooltip: {
                valueFormatter: (value: unknown) =>
                  formatValue(formatterValue(value), field.format)
              }
            }
          : {}),
        data: rows.map((row) => finiteNumber(row[field.field]))
      };
    })
  };
}

/** 圆角只加在柱条的"生长端"(横向为右侧,纵向为顶端) */
function roundedCorners(props: BarChartProps): number[] {
  return props.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
}
