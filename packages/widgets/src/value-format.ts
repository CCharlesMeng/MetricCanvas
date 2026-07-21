import type { FieldValue, ValueFormatPreset } from '@metriccanvas/page';

export type ValuePolarity = 'positive' | 'negative' | 'neutral';

const DEFAULT_NULL_TEXT = '—';
/**
 * 将数据快照中的原始值翻译为展示文本。
 * 百分比值沿用数据服务约定:4.24 表示 4.24%,不在组件侧乘 100。
 */
export function formatValue(
  value: FieldValue | undefined,
  format?: ValueFormatPreset
): string {
  if (value == null) return DEFAULT_NULL_TEXT;
  if (!format || format === 'text') return String(value);
  if (format === 'date') return formatDate(value);
  if (format === 'date-month-day') {
    const date = formatDate(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : date;
  }

  const numeric = finiteNumber(value);
  if (numeric === undefined) return String(value);

  switch (format) {
    case 'number':
      return String(numeric);
    case 'number-1':
      return formatNumber(numeric, 1);
    case 'number-2':
      return formatNumber(numeric, 2);
    case 'number-grouped':
      return formatNumber(numeric, undefined, true);
    case 'compact-wan-0':
      return `${formatNumber(numeric / 1e4, 0, true)}万`;
    case 'compact-wan-1':
      return `${formatNumber(numeric / 1e4, 1, true)}万`;
    case 'compact-yi-1':
      return `${formatNumber(numeric / 1e8, 1, true)}亿`;
    case 'percent-0':
      return `${formatNumber(numeric, 0)}%`;
    case 'percent-1':
      return `${formatNumber(numeric, 1)}%`;
    case 'percent-2':
      return `${formatNumber(numeric, 2)}%`;
    case 'percent-2-signed':
      return `${numeric > 0 ? '+' : ''}${formatNumber(numeric, 2)}%`;
  }
}

/** 按原始数值正负返回语义色状态;非数值与 0 均为 neutral。 */
export function valuePolarity(
  value: FieldValue | undefined
): ValuePolarity {
  const numeric = value == null ? undefined : finiteNumber(value);
  if (numeric === undefined || numeric === 0) return 'neutral';
  return numeric > 0 ? 'positive' : 'negative';
}

function finiteNumber(value: FieldValue): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  if (value.trim() === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function formatNumber(
  value: number,
  fractionDigits: number | undefined = undefined,
  grouped = false
): string {
  return new Intl.NumberFormat('en-US', {
    useGrouping: grouped,
    ...(fractionDigits === undefined
      ? {}
      : {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits
        })
  }).format(value);
}

function formatDate(value: FieldValue): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const calendarDate = /^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/.exec(trimmed);
    return calendarDate?.[1] ?? trimmed;
  }

  if (typeof value !== 'number') return String(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}
