import { describe, expect, it } from 'vitest';
import {
  normalizeProgressValue,
  progressRingOption
} from '../src/components/metric-card/ring-options';

interface TestedProgressRingOption {
  animationDuration: number;
  animationDurationUpdate: number;
  series: Array<{
    id: string;
    type: string;
    startAngle?: number;
    endAngle?: number | 'auto';
    radius: string[];
    data: Array<{ value: number; itemStyle: { color: string; borderRadius?: number } }>;
  }>;
}

describe('progressRingOption', () => {
  it('让可见轨道固定占 75%，蓝色进度按完成率填充该轨道', () => {
    const option = progressRingOption(98.2, 75) as TestedProgressRingOption;
    const [track, progress] = option.series;

    expect(option.animationDuration).toBeGreaterThan(0);
    expect(option.animationDurationUpdate).toBeGreaterThan(0);
    expect(track).toMatchObject({
      id: 'progress-ring-track',
      type: 'pie',
      startAngle: 225,
      endAngle: 315,
      radius: ['82%', '100%'],
      data: [{ value: 1, itemStyle: { color: '#e5eaff', borderRadius: 999 } }]
    });
    expect(progress).toMatchObject({
      id: 'progress-ring-value',
      type: 'pie',
      startAngle: 225,
      radius: ['82%', '100%'],
      data: [{ value: 1, itemStyle: { color: '#5b72ea', borderRadius: 999 } }]
    });
    expect(progress.endAngle).toBeCloseTo(319.86, 2);
  });

  it('0% 保留 75% 浅色轨道，100% 刚好填满这条轨道', () => {
    const empty = progressRingOption(0, 75) as TestedProgressRingOption;
    const full = progressRingOption(100, 75) as TestedProgressRingOption;

    expect(empty.series[0]).toMatchObject({ startAngle: 225, endAngle: 315 });
    expect(empty.series[1]).toMatchObject({ startAngle: 225, endAngle: 225 });
    expect(full.series[0]).toMatchObject({ startAngle: 225, endAngle: 315 });
    expect(full.series[1]).toMatchObject({ startAngle: 225, endAngle: 315 });
  });

  it('未配置可见轨道比例时默认使用完整圆环', () => {
    const option = progressRingOption(100) as TestedProgressRingOption;

    expect(option.series[0]).toMatchObject({ endAngle: 'auto' });
    expect(option.series[1]).toMatchObject({ endAngle: 'auto' });
  });

  it('把异常或越界进度限制在 0 到 100', () => {
    expect(normalizeProgressValue(Number.NaN)).toBe(0);
    expect(normalizeProgressValue(-1)).toBe(0);
    expect(normalizeProgressValue(101)).toBe(100);
  });
});
