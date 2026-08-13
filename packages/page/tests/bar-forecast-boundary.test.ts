import { describe, expect, it } from 'vitest';
import { barForecastBoundaryIssues } from '../src';
import type { BarChartProps } from '../src';

/**
 * 实际/预测边界规则的首个专属测试(此前零覆盖,见 issue #72)。
 * 规则:以采集时间所在月为界,统计月及之前不得有预测值,统计月之后不得有实际值;
 * 仅对 "N月" 类目与显式 actual/forecast role 生效。
 */

const props: BarChartProps = {
  categoryField: 'month',
  series: [
    { field: 'actualValue', role: 'actual' },
    { field: 'forecastValue', role: 'forecast' }
  ]
};

const capturedAt = '2026-06-15T08:00:00Z';

describe('barForecastBoundaryIssues', () => {
  it('合法排布:统计月及之前只有实际,之后只有预测,无问题', () => {
    const rows = [
      { month: '5月', actualValue: 100, forecastValue: null },
      { month: '6月', actualValue: 120, forecastValue: null },
      { month: '7月', actualValue: null, forecastValue: 130 }
    ];
    expect(barForecastBoundaryIssues(props, rows, capturedAt)).toEqual([]);
  });

  it('统计月及之前出现预测值:报告问题并定位行与字段', () => {
    const rows = [{ month: '6月', actualValue: null, forecastValue: 130 }];
    const issues = barForecastBoundaryIssues(props, rows, capturedAt);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rowIndex: 0, field: 'forecastValue' });
  });

  it('统计月之后出现实际值:报告问题', () => {
    const rows = [{ month: '7月', actualValue: 110, forecastValue: null }];
    const issues = barForecastBoundaryIssues(props, rows, capturedAt);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rowIndex: 0, field: 'actualValue' });
  });

  it('无 role 的系列不参与判定', () => {
    const noRoleProps: BarChartProps = {
      categoryField: 'month',
      series: [{ field: 'value' }]
    };
    const rows = [{ month: '7月', value: 110 }];
    expect(barForecastBoundaryIssues(noRoleProps, rows, capturedAt)).toEqual([]);
  });

  it('类目不是 "N月" 形态时规则静默不生效', () => {
    const rows = [
      { month: '2026-07', actualValue: 110, forecastValue: null },
      { month: 'Q3', actualValue: 110, forecastValue: null }
    ];
    expect(barForecastBoundaryIssues(props, rows, capturedAt)).toEqual([]);
  });

  it('capturedAt 无法解析出月份时规则静默不生效', () => {
    const rows = [{ month: '7月', actualValue: 110, forecastValue: null }];
    expect(barForecastBoundaryIssues(props, rows, 'not-a-date')).toEqual([]);
  });

  it('null 值不视为提供了系列数据', () => {
    const rows = [{ month: '6月', actualValue: null, forecastValue: null }];
    expect(barForecastBoundaryIssues(props, rows, capturedAt)).toEqual([]);
  });

  it('对象形式的字段绑定同样生效', () => {
    const boundProps: BarChartProps = {
      categoryField: { data: 'main', field: 'month' },
      series: [{ field: { data: 'main', field: 'forecastValue' }, role: 'forecast' }]
    };
    const rows = [{ month: '5月', forecastValue: 99 }];
    const issues = barForecastBoundaryIssues(boundProps, rows, capturedAt);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.field).toBe('forecastValue');
  });
});
