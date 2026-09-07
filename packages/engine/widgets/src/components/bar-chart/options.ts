import type { BarChartProps, ValueFormatPreset } from '@metriccanvas/page';
import type { EChartsOption, LabelLayoutOptionCallbackParams } from 'echarts';
import type { MainDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { finiteNumber, formatValue, wanUnits } from '../../shared/value-format';
import { CHART_PALETTE, GRID, dualOrSingleAxis, formatterValue } from '../../shared/chart-option';
import { serialColor, type ColorList } from '../../shared/chart-palette';

const REPORT_COLORS = ['#1476ff', '#0cb8b2'] as const;
const REPORT_FORECAST_COLORS = [
  'rgba(20, 118, 255, 0.2)',
  'rgba(12, 184, 178, 0.2)'
] as const;
const FLOATING_LABEL_MIN_LENGTH = 7;

/**
 * 已解析命名数据槽 + 柱状图 props → ECharts option 的纯翻译。
 * 标签继承字段契约;最终格式由组件字段绑定覆盖 defaultFormat 展示建议。
 *
 * `palette` 缺席即沿用包内 `CHART_PALETTE`(报表形态的既有取值);给出时
 * 它同时接管 role 档位色与未显式着色系列的取色。`reportForecast` 变体的
 * 实测/预测双色是该变体自己的语义色,不受形态色板影响。
 */
export function barOption(
  data: MainDataSlots,
  props: BarChartProps,
  palette?: ColorList
): EChartsOption {
  const rows = data.main.snapshot.rows;
  const category = resolveField(props.categoryField, data);
  const categories = rows.map((row) =>
    formatValue(row[category.field], category.format)
  );
  const categoryAxis = { type: 'category' as const, data: categories };
  const baseValueAxis = dualOrSingleAxis(props.dualAxis, props.series.length);
  const reportValueFormat = props.series[0]
    ? resolveField(props.series[0].field, data).format
    : undefined;
  const valueAxis = props.variant === 'reportForecast'
    ? reportValueAxis(baseValueAxis, reportValueFormat)
    : baseValueAxis;
  const reportForecast = props.variant === 'reportForecast';
  const roleIndexes = { actual: 0, forecast: 0 };
  const seriesEntries = props.series
    .map((series, originalIndex) => ({
      series,
      originalIndex,
      roleIndex: series.role === undefined ? undefined : roleIndexes[series.role]++
    }))
    .sort((left, right) => {
      const orderDifference =
        (left.series.stackOrder ?? left.originalIndex) -
        (right.series.stackOrder ?? right.originalIndex);
      return orderDifference || left.originalIndex - right.originalIndex;
    });
  const topEntryByGroup = new Map<string, (typeof seriesEntries)[number]>();
  for (const entry of seriesEntries) {
    topEntryByGroup.set(entry.series.role ?? 'default', entry);
  }
  const stackTotals = rows.map((row) =>
    props.series.reduce((total, series) => {
      const field = resolveField(series.field, data);
      return total + (finiteNumber(row[field.field]) ?? 0);
    }, 0)
  );
  const legendData = props.series.map((series) => {
    const field = resolveField(series.field, data);
    return series.label ?? field.definition?.label ?? field.field;
  });
  return {
    ...(palette ? { color: [...palette] } : {}),
    grid: reportForecast
      ? { top: 44, right: 0, bottom: 20, left: 0, containLabel: true }
      : GRID,
    tooltip: { trigger: 'axis', confine: true },
    ...(props.series.length > 1
      ? {
          legend: reportForecast
            ? {
                top: 0,
                right: 0,
                ...(props.series.some((series) => series.stackOrder !== undefined)
                  ? { data: legendData }
                  : {})
              }
            : { top: 0, left: 0 }
        }
      : {}),
    // 横向条形:类目轴与数值轴对调(覆盖存量两个水平条形组件的场景)
    xAxis: props.horizontal ? valueAxis : categoryAxis,
    yAxis: props.horizontal ? categoryAxis : valueAxis,
    series: seriesEntries.map((entry) => {
      const { series, originalIndex, roleIndex } = entry;
      const field = resolveField(series.field, data);
      const roleColor =
        roleIndex === undefined
          ? undefined
          : reportForecast
            ? REPORT_COLORS[roleIndex % REPORT_COLORS.length]
            : (serialColor(palette, roleIndex) ??
              CHART_PALETTE[roleIndex % CHART_PALETTE.length]);
      const forecastColor =
        roleIndex === undefined || !reportForecast
          ? roleColor
          : REPORT_FORECAST_COLORS[roleIndex % REPORT_FORECAST_COLORS.length];
      const isTopSeries =
        !props.stacked || topEntryByGroup.get(series.role ?? 'default') === entry;
      const itemStyle = {
        ...(props.rounded
          ? {
              borderRadius: isTopSeries
                ? roundedCorners(props)
                : [0, 0, 0, 0]
            }
          : {}),
        ...(series.role === 'actual' ? { color: roleColor } : {}),
        ...(series.role === 'forecast'
          ? {
              color: forecastColor,
              ...(!reportForecast ? { opacity: 0.35 } : {}),
              borderColor: roleColor,
              borderType: 'dashed' as const,
              borderWidth: 1
            }
          : {})
      };
      const values = rows.map((row) => finiteNumber(row[field.field]));
      const segmentLabelFormatter = valueLabelFormatter(field.format);
      const displayedValues = props.showSegmentLabels
        ? values.map((value) => {
            if (value === undefined) return undefined;
            return isFloatingLabel(segmentLabelFormatter({ value }))
              ? {
                  value,
                  label: floatingLabelStyle(roleColor)
                }
              : value;
          })
        : values;
      const totalPoints = rows.flatMap((row, rowIndex) => {
        if (values[rowIndex] === undefined) return [];
        const value = stackTotals[rowIndex] ?? 0;
        return [{ name: categories[rowIndex] ?? '', coord: [categories[rowIndex], value], value }];
      });
      return {
        name: series.label ?? field.definition?.label ?? field.field,
        type: 'bar' as const,
        ...(props.stacked ? { stack: 'total' } : {}),
        ...(reportForecast ? { barWidth: 40 } : {}),
        ...(props.dualAxis && originalIndex > 0 ? { yAxisIndex: 1 } : {}),
        ...(Object.keys(itemStyle).length > 0 ? { itemStyle } : {}),
        ...(props.showSegmentLabels
          ? {
              // 短金额保持柱内居中；长金额才横向避让，避免在画布边缘被截断。
              labelLayout: floatingLabelLayout,
              label: {
                show: true,
                position: 'inside' as const,
                color: series.role === 'forecast' ? roleColor : '#fff',
                fontSize: 12,
                formatter: segmentLabelFormatter
              }
            }
          : {}),
        ...(props.showStackTotalLabels && isTopSeries
          ? {
              markPoint: {
                symbol: 'circle',
                symbolSize: 0,
                silent: true,
                label: {
                  show: true,
                  position: 'top' as const,
                  distance: 5,
                  color: '#121e3b',
                  fontSize: 12,
                  formatter: valueLabelFormatter(field.format)
                },
                data: totalPoints
              }
            }
          : {}),
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
        data: displayedValues
      };
    })
  };
}

function valueLabelFormatter(format?: ValueFormatPreset) {
  return (params: unknown): string => {
    const value = finiteNumber(formatterValue((params as { value?: unknown })?.value));
    if (value === undefined) return '';
    return format === undefined ? `${wanUnits(value)}万` : formatValue(value, format);
  };
}

function floatingLabelLayout({ text }: LabelLayoutOptionCallbackParams) {
  return isFloatingLabel(text)
    ? { moveOverlap: 'shiftX' as const }
    : {};
}

function isFloatingLabel(text: string): boolean {
  return text.length >= FLOATING_LABEL_MIN_LENGTH;
}

function floatingLabelStyle(color?: string) {
  return {
    color: color ?? '#121e3b',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 2,
    padding: [1, 3]
  };
}

function reportValueAxis(
  axis: ReturnType<typeof dualOrSingleAxis>,
  format?: ValueFormatPreset
) {
  if (Array.isArray(axis)) return axis;
  if (format !== undefined) {
    return {
      ...axis,
      axisLabel: {
        formatter: (value: number) => formatValue(value, format)
      }
    };
  }
  return {
    ...axis,
    name: '万',
    nameLocation: 'end' as const,
    nameGap: 8,
    axisLabel: {
      formatter: (value: number) => wanUnits(value, 0, false)
    }
  };
}

/** 圆角只加在堆叠整体的"生长端"；底层色块保持直角以便连接边缘齐平。 */
function roundedCorners(props: BarChartProps): number[] {
  return props.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
}
