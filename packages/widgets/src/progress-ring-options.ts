import type { EChartsOption } from 'echarts';

export function normalizeProgressValue(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * 完成率圆环使用完整 gauge 轨道：value 驱动蓝色进度并参与更新动画。
 * 文本继续由 HTML 覆盖层承载，以保持清晰的排版和无画布依赖的可访问名称。
 */
export function progressRingOption(value: number): EChartsOption {
  const normalized = normalizeProgressValue(value);

  return {
    animationDuration: 500,
    animationDurationUpdate: 420,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    series: [
      {
        id: 'progress-ring',
        type: 'gauge',
        silent: true,
        startAngle: 225,
        endAngle: -135,
        min: 0,
        max: 100,
        radius: '80%',
        pointer: { show: false },
        anchor: { show: false },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          width: 8,
          itemStyle: { color: '#5b72ea' }
        },
        axisLine: {
          lineStyle: {
            width: 8,
            color: [[1, '#e5eaff']]
          }
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: { show: false },
        data: [{ value: normalized }]
      }
    ]
  };
}
