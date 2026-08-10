import type { FieldBinding } from './field';
import type { BarChartProps } from './page';
import type { Row } from './snapshot';

export interface BarForecastBoundaryIssue {
  rowIndex: number;
  field: string;
  message: string;
}

/**
 * 以报告采集时间所在月为边界，保证实际与预测柱不跨越时间语义。
 * 仅对“N月”类别和显式 actual/forecast role 生效；其他柱图不受影响。
 */
export function barForecastBoundaryIssues(
  props: BarChartProps,
  rows: ReadonlyArray<Row>,
  capturedAt: string
): BarForecastBoundaryIssue[] {
  const capturedMonth = reportMonth(capturedAt);
  if (capturedMonth === undefined) return [];

  const categoryField = fieldName(props.categoryField);
  const issues: BarForecastBoundaryIssue[] = [];
  rows.forEach((row, rowIndex) => {
    const month = categoryMonth(row[categoryField]);
    if (month === undefined) return;
    props.series.forEach((series) => {
      if (!series.role) return;
      const field = fieldName(series.field);
      if (row[field] === null) return;
      if (series.role === 'forecast' && month <= capturedMonth) {
        issues.push({
          rowIndex,
          field,
          message: `${month}月为统计月及之前不得提供预测系列 ${field}`
        });
      }
      if (series.role === 'actual' && month > capturedMonth) {
        issues.push({
          rowIndex,
          field,
          message: `${month}月为统计月之后不得提供实际系列 ${field}`
        });
      }
    });
  });
  return issues;
}

function reportMonth(capturedAt: string): number | undefined {
  const match = /^\d{4}-(\d{2})-/u.exec(capturedAt);
  if (!match) return undefined;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? month : undefined;
}

function categoryMonth(value: Row[string]): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{1,2})月$/u.exec(value.trim());
  if (!match) return undefined;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? month : undefined;
}

function fieldName(binding: FieldBinding): string {
  return typeof binding === 'string' ? binding : binding.field;
}
