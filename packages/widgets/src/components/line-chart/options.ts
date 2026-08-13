import type { LineChartProps } from '@metriccanvas/page';
import type { EChartsOption } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { fieldLabel, resolveField } from '../../shared/component-data';
import { finiteNumber, formatValue } from '../../shared/value-format';
import { CHART_PALETTE, GRID, dualOrSingleAxis, formatterValue } from '../../shared/chart-option';

/**
 * 已解析命名数据槽 + 折线图 props → ECharts option 的纯翻译。
 * 标签继承字段契约;最终格式由组件字段绑定覆盖 defaultFormat 展示建议。
 */
export function lineOption(data: MainDataSlots, props: LineChartProps): EChartsOption {
  const rows = data.main.snapshot.rows;
  const x = resolveField(props.xField, data);

  return {
    grid: props.showPointLabels ? { ...GRID, top: 36, right: 30 } : GRID,
    tooltip: { trigger: 'axis', confine: true, hideDelay: 200 },
    ...(props.series.length > 1 ? { legend: { top: 0, left: 0 } } : {}),
    xAxis: {
      type: 'category',
      name: fieldLabel(props.xField, data),
      data: rows.map((row) => formatValue(row[x.field], x.format))
    },
    yAxis: dualOrSingleAxis(props.dualAxis, props.series.length, props.hideYAxis),
    series: props.series.map((series, i) => {
      const field = resolveField(series.field, data);
      return {
        name: series.label ?? field.definition?.label ?? field.field,
        type: 'line' as const,
        smooth: props.smooth ?? false,
        ...(props.stacked ? { stack: 'total' } : {}),
        ...(props.dualAxis && i > 0 ? { yAxisIndex: 1 } : {}),
        ...(props.areaGradient ? { areaStyle: gradientArea(i) } : {}),
        ...(props.showPointLabels
          ? {
              label: {
                show: true,
                position: 'top' as const,
                color: '#191919',
                fontSize: 12,
                formatter: (params: unknown) =>
                  formatValue(formatterValue(params), field.format)
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

/** 面积渐变:按系列色从 35% 不透明度渐隐到底部(色板真源在 shared/chart-option.ts) */
function gradientArea(seriesIndex: number) {
  const color = CHART_PALETTE[seriesIndex % CHART_PALETTE.length]!;
  return {
    color: {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: withAlpha(color, 0.35) },
        { offset: 1, color: withAlpha(color, 0.02) }
      ]
    }
  };
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
