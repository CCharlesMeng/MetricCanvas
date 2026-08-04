import type { EChartsOption } from 'echarts';

export function normalizeProgressValue(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

const PROGRESS_START_ANGLE = 225;

function progressEndAngle(value: number): number | 'auto' {
  if (value <= 0) return PROGRESS_START_ANGLE;
  if (value >= 100) return 'auto';
  return PROGRESS_START_ANGLE + 360 * (1 - value / 100);
}

/**
 * 完成率圆环由浅色可见轨道和蓝色进度 pie 叠加组成。
 * ringPercent 决定可见轨道占整圆的比例，value 决定蓝色进度填充该轨道的比例。
 * 文本继续由 HTML 覆盖层承载，以保持清晰的排版和无画布依赖的可访问名称。
 */
export function progressRingOption(value: number, ringPercent = 100): EChartsOption {
  const normalizedValue = normalizeProgressValue(value);
  const normalizedRingPercent = normalizeProgressValue(ringPercent);
  const filledPercent = normalizedRingPercent * (normalizedValue / 100);

  return {
    animationDuration: 500,
    animationDurationUpdate: 420,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    series: [
      {
        id: 'progress-ring-track',
        type: 'pie',
        silent: true,
        clockwise: true,
        startAngle: PROGRESS_START_ANGLE,
        endAngle: progressEndAngle(normalizedRingPercent),
        radius: ['62%', '80%'],
        label: { show: false },
        emphasis: { disabled: true },
        animation: false,
        data: [
          {
            value: 1,
            itemStyle: { color: '#e5eaff', borderRadius: 999 }
          }
        ]
      },
      {
        id: 'progress-ring-value',
        type: 'pie',
        silent: true,
        clockwise: true,
        startAngle: PROGRESS_START_ANGLE,
        endAngle: progressEndAngle(filledPercent),
        radius: ['62%', '80%'],
        label: { show: false },
        emphasis: { disabled: true },
        data: [
          {
            value: 1,
            itemStyle: { color: '#5b72ea', borderRadius: 999 }
          }
        ]
      }
    ]
  };
}
