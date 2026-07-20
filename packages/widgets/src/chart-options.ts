import type {
  BarChartDisplay,
  LineChartDisplay,
  PieChartDisplay,
  Row
} from '@metriccanvas/page';
import type { EChartsOption } from 'echarts';

/**
 * 数据快照 → ECharts option 的纯翻译。展示配置面是《组件分析.md》§2 定死的
 * 封闭集合(PRD),超出的诉求走 DSL 缺口决策程序(ADR-0003),不在此扩。
 */

/** ECharts 默认色板(面积渐变需要按系列色构造 colorStops,故显式持有) */
const PALETTE = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452'];

const GRID = { left: 8, right: 12, top: 28, bottom: 4, containLabel: true } as const;

export function lineOption(
  rows: Row[],
  metrics: string[],
  dimension: string,
  display: LineChartDisplay = {}
): EChartsOption {
  return {
    grid: GRID,
    tooltip: { trigger: 'axis' },
    ...(metrics.length > 1 ? { legend: { top: 0, left: 0 } } : {}),
    xAxis: { type: 'category', data: rows.map((row) => String(row[dimension] ?? '')) },
    yAxis: dualOrSingleAxis(display.dualAxis, metrics.length),
    series: metrics.map((metric, i) => ({
      name: metric,
      type: 'line' as const,
      smooth: display.smooth ?? false,
      ...(display.stacked ? { stack: 'total' } : {}),
      ...(display.dualAxis && i > 0 ? { yAxisIndex: 1 } : {}),
      ...(display.areaGradient ? { areaStyle: gradientArea(i) } : {}),
      data: rows.map((row) => numberOrGap(row[metric]))
    }))
  };
}

export function barOption(
  rows: Row[],
  metrics: string[],
  dimension: string,
  display: BarChartDisplay = {}
): EChartsOption {
  const categories = rows.map((row) => String(row[dimension] ?? ''));
  const categoryAxis = { type: 'category' as const, data: categories };
  const valueAxis = dualOrSingleAxis(display.dualAxis, metrics.length);
  return {
    grid: GRID,
    tooltip: { trigger: 'axis' },
    ...(metrics.length > 1 ? { legend: { top: 0, left: 0 } } : {}),
    // 横向条形:类目轴与数值轴对调(覆盖存量两个水平条形组件的场景)
    xAxis: display.horizontal ? valueAxis : categoryAxis,
    yAxis: display.horizontal ? categoryAxis : valueAxis,
    series: metrics.map((metric, i) => ({
      name: metric,
      type: 'bar' as const,
      ...(display.stacked ? { stack: 'total' } : {}),
      ...(display.dualAxis && i > 0 ? { yAxisIndex: 1 } : {}),
      ...(display.rounded ? { itemStyle: { borderRadius: roundedCorners(display) } } : {}),
      data: rows.map((row) => numberOrGap(row[metric]))
    }))
  };
}

export function pieOption(
  rows: Row[],
  metric: string,
  dimension: string,
  display: PieChartDisplay = {}
): EChartsOption {
  const showLabelLine = display.labelLine ?? true;
  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: display.ring ? [display.ring, '72%'] : '72%',
        label: { show: showLabelLine, formatter: '{b}: {d}%' },
        labelLine: { show: showLabelLine },
        data: rows.map((row) => ({
          name: String(row[dimension] ?? ''),
          value: numberOrGap(row[metric]) ?? 0
        }))
      }
    ]
  };
}

/** 双轴:第二个及之后的指标走右轴;单轴时只留左轴 */
function dualOrSingleAxis(dualAxis: boolean | undefined, metricCount: number) {
  if (dualAxis && metricCount > 1) {
    return [{ type: 'value' as const }, { type: 'value' as const }];
  }
  return { type: 'value' as const };
}

/** 面积渐变:按系列色从 35% 不透明度渐隐到底部 */
function gradientArea(seriesIndex: number) {
  const color = PALETTE[seriesIndex % PALETTE.length];
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

/** 圆角只加在柱条的"生长端"(横向为右侧,纵向为顶端) */
function roundedCorners(display: BarChartDisplay): number[] {
  return display.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
}

/** 稀疏指标(某维度组合缺行)按数据缺口处理,折线断开、柱条不画 */
function numberOrGap(value: Row[string] | undefined): number | undefined {
  return typeof value === 'number' ? value : value == null ? undefined : Number(value);
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
