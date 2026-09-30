import type { ValueFormatPreset } from '@metriccanvas/page/internal';
import { formatValue } from './value-format';

/**
 * 直角坐标系图表共用的 ECharts option 片段。
 * 只放被两个以上图表目录消费的部分,单一图表私有的构造留在各自的 options.ts。
 */

/** 绘图区内边距 */
export const GRID = { left: 8, right: 12, top: 28, bottom: 4, containLabel: true } as const;

/**
 * 业务图表默认色板(ECharts 默认七色)。
 * 柱状图 role 着色与折线面积渐变共用,单一真源,不得在组件目录内复制。
 */
export const CHART_PALETTE = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452'
] as const;

/** 双轴:第二个及之后的指标走右轴;单轴时只留左轴 */
export function dualOrSingleAxis(
  dualAxis: boolean | undefined,
  metricCount: number,
  hideAxis = false,
  formats: Array<ValueFormatPreset | undefined> = []
) {
  // One axis has one scale. Mixed formats keep raw ticks rather than choosing
  // the first series' unit for unrelated values on that axis.
  const axis = (group: Array<ValueFormatPreset | undefined>) => ({
    type: 'value' as const,
    ...(group.length && group[0] && group.every(format => format === group[0])
      ? { axisLabel: { formatter: (value: number) => formatValue(value, group[0]) } }
      : {}),
    ...(hideAxis
      ? {
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false }
        }
      : {})
  });
  if (dualAxis && metricCount > 1) {
    return [axis(formats.slice(0, 1)), axis(formats.slice(1))];
  }
  return axis(formats);
}

/** ECharts 回调载荷(标量或 { value })→ 可交给 formatValue 的标量 */
export function formatterValue(value: unknown): string | number | null | undefined {
  if (typeof value === 'string' || typeof value === 'number' || value == null) return value;
  if (typeof value !== 'object') return undefined;
  const candidate = (value as { value?: unknown }).value;
  return typeof candidate === 'string' || typeof candidate === 'number' || candidate == null
    ? candidate
    : undefined;
}

/** Window categories without discarding any result rows. */
export function categoryWindow(count: number, horizontal = false) {
  if (count <= 20) return {};
  const axis = horizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
  return { dataZoom: [
    { type: 'slider' as const, ...axis, startValue: 0, endValue: 19,
      filterMode: 'none' as const, ...(horizontal ? { right: 0, width: 16 } : { bottom: 0, height: 18 }) },
    { type: 'inside' as const, ...axis, startValue: 0, endValue: 19, filterMode: 'none' as const }
  ] };
}
