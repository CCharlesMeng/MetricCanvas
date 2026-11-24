import { describe, expect, it } from 'vitest';
import type { TooltipComponentOption } from 'echarts';
import { chartTooltip } from '../src/shared/chart-tooltip';
import { mergeChartOption } from '../src/shared/chart-option-extension';

const colored = {
  field: { format: 'points-1-signed' as const },
  series: { tooltip: { colorRule: { mode: 'sign' as const, positive: 'green' as const, negative: 'red' as const } } }
};

describe('axis tooltip color rule', () => {
  it('colors formatted values while escaping snapshot text and retaining native markers', () => {
    const formatter = chartTooltip([
      colored,
      { field: { missingText: '<暂缺>' }, series: {} }
    ], undefined).formatter as (points: unknown) => string;
    const markup = formatter([
      { axisValueLabel: '<月份>', seriesName: '变化&趋势', seriesIndex: 0, value: -2.5, marker: '<span class="native-marker"></span>' },
      { seriesName: '月环比', seriesIndex: 1, value: null },
      { seriesName: '舍入', seriesIndex: 0, value: 0.04 }
    ]);
    expect(markup).toContain('&lt;月份&gt;');
    expect(markup).toContain('变化&amp;趋势');
    expect(markup).toContain('<span class="native-marker"></span>');
    expect(markup).toContain('color:var(--mc-color-negative, #f5222d);">-2.5P');
    expect(markup).toContain('font-weight:700;">&lt;暂缺&gt;');
    expect(markup).toContain('font-weight:700;">0P');
  });

  it('uses native options when unconfigured or when advanced rich text takes precedence', () => {
    expect(chartTooltip([], undefined, { hideDelay: 200 })).toEqual({ trigger: 'axis', confine: true, hideDelay: 200 });
    expect(chartTooltip([colored], { renderMode: 'richText' }).formatter).toBeUndefined();
    const base = { tooltip: chartTooltip([colored], undefined) };
    const merged = mergeChartOption(base, { tooltip: { formatter: '{b} {c}' } });
    expect((merged.tooltip as TooltipComponentOption).formatter).toBe('{b} {c}');
  });
});
