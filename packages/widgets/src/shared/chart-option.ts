/**
 * 直角坐标系图表共用的 ECharts option 片段。
 * 只放被两个以上图表目录消费的部分,单一图表私有的构造留在各自的 options.ts。
 */

/** 绘图区内边距 */
export const GRID = { left: 8, right: 12, top: 28, bottom: 4, containLabel: true } as const;

/** 双轴:第二个及之后的指标走右轴;单轴时只留左轴 */
export function dualOrSingleAxis(
  dualAxis: boolean | undefined,
  metricCount: number,
  hideAxis = false
) {
  const axis = () => ({
    type: 'value' as const,
    ...(hideAxis
      ? {
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false }
        }
      : {})
  });
  if (dualAxis && metricCount > 1) {
    return [axis(), axis()];
  }
  return axis();
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
