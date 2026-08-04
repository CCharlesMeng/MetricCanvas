import { describe, expect, it } from 'vitest';
import {
  normalizeProgressValue,
  progressRingOption
} from '../src/progress-ring-options';

interface TestedProgressRingOption {
  animationDuration: number;
  animationDurationUpdate: number;
  series: Array<{
    id: string;
    type: string;
    startAngle: number;
    endAngle: number;
    progress: { show: boolean; roundCap: boolean; width: number };
    axisLine: { lineStyle: { width: number; color: Array<[number, string]> } };
    data: Array<{ value: number }>;
  }>;
}

describe('progressRingOption', () => {
  it('生成可平滑更新的完整轨道，并让 75% 进度留下底部四分之一轨道', () => {
    const option = progressRingOption(75) as TestedProgressRingOption;
    const gauge = option.series[0];

    expect(option.animationDuration).toBeGreaterThan(0);
    expect(option.animationDurationUpdate).toBeGreaterThan(0);
    expect(gauge).toMatchObject({
      id: 'progress-ring',
      type: 'gauge',
      startAngle: 225,
      endAngle: -135,
      progress: { show: true, roundCap: true, width: 8 },
      axisLine: { lineStyle: { width: 8, color: [[1, '#e5eaff']] } },
      data: [{ value: 75 }]
    });
  });

  it('把异常或越界进度限制在 0 到 100', () => {
    expect(normalizeProgressValue(Number.NaN)).toBe(0);
    expect(normalizeProgressValue(-1)).toBe(0);
    expect(normalizeProgressValue(101)).toBe(100);
  });
});
