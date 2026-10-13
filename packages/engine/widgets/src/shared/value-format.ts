import type { FieldValue, ValueFormatPreset } from '@metriccanvas/page/internal';
import { formatPeriod } from '@metriccanvas/page/internal';

export type ValuePolarity = 'positive' | 'negative' | 'neutral';
type SignedNumberFormat = Extract<ValueFormatPreset, `number${string}-signed`>;

const DEFAULT_NULL_TEXT = '—';
/**
 * 将数据快照中的原始值翻译为展示文本。
 * 百分比值沿用数据服务约定:4.24 表示 4.24%,不在组件侧乘 100。
 */
export function formatValue(
  value: FieldValue | undefined,
  format?: ValueFormatPreset,
  missingText = DEFAULT_NULL_TEXT
): string {
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return missingText;
  if (!format || format === 'text') return String(value);
  if (format === 'period') return formatPeriod(String(value));
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
    case 'number-signed':
    case 'number-1-signed':
    case 'number-2-signed':
    case 'number-grouped-signed':
      return signedNumberPresentation(numeric, format).text;
    case 'number-2':
      return formatNumber(numeric, 2);
    case 'number-grouped':
      return formatNumber(numeric, undefined, true);
    case 'compact-wan-0':
      return `${wanUnits(numeric, 0)}万`;
    case 'compact-wan-1':
      return `${wanUnits(numeric, 1)}万`;
    case 'compact-million-0':
      return `${formatNumber(numeric / 1e6, 0, true)}百万`;
    case 'compact-million-1':
      return `${formatNumber(numeric / 1e6, 1, true)}百万`;
    case 'compact-million-2':
      return `${formatNumber(numeric / 1e6, 2, true)}百万`;
    case 'compact-yi-1':
      return `${formatNumber(numeric / 1e8, 1, true)}亿`;
    case 'cny-adaptive':
      return formatCnyAdaptive(numeric);
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

/** 新增 signed 数值格式按展示精度判断方向；其它格式仍按原始值。 */
export function valuePolarity(
  value: FieldValue | undefined,
  format?: ValueFormatPreset
): ValuePolarity {
  const numeric = finiteNumber(value);
  if (numeric === undefined || numeric === 0) return 'neutral';
  if (isSignedNumberFormat(format)) return signedNumberPresentation(numeric, format).polarity;
  return numeric > 0 ? 'positive' : 'negative';
}

export function isSignedNumberFormat(
  format: ValueFormatPreset | undefined
): format is SignedNumberFormat {
  return format?.startsWith('number') === true && format.endsWith('-signed');
}

/** 文本与方向共用同一次舍入，负零及舍入到零均无符号。 */
function signedNumberPresentation(value: number, format: SignedNumberFormat) {
  let magnitude: string;
  switch (format) {
    case 'number-signed': magnitude = String(Math.abs(value)); break;
    case 'number-1-signed': magnitude = formatNumber(Math.abs(value), 1); break;
    case 'number-2-signed': magnitude = formatNumber(Math.abs(value), 2); break;
    case 'number-grouped-signed': magnitude = formatNumber(Math.abs(value), undefined, true); break;
  }
  const polarity: ValuePolarity = Number(magnitude.replaceAll(',', '')) === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative';
  return { text: `${polarity === 'positive' ? '+' : polarity === 'negative' ? '-' : ''}${magnitude}`, polarity };
}

/**
 * 数据值 → 有限数字。空值、布尔、空串、非数值字符串与 NaN/Infinity 一律视为缺失。
 * 展示格式化、表格 rateBar 与图表的数据缺口(折线断开、柱条不画)共用这一份判定。
 */
export function finiteNumber(value: FieldValue | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  if (value.trim() === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * 数值 → 以「万」为单位的数字文本(不含单位后缀)。
 * compact-wan 预设、图表数值标签与轴刻度共用这一份换算与舍入,
 * 不得在组件目录内另写 /1e4 + 取整的第二实现。
 */
export function wanUnits(value: number, fractionDigits = 0, grouped = true): string {
  return formatNumber(value / 1e4, fractionDigits, grouped);
}

// 人民币元值按原始绝对值选档，再执行该档位的舍入。
function formatCnyAdaptive(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  const magnitude = Math.abs(normalized);
  if (magnitude < 10_000) {
    return `${formatNumber(normalized, 0, true)}元`;
  }
  if (magnitude < 100_000) {
    return `${formatNumber(normalized / 1e4, 2, true)}万`;
  }
  if (magnitude < 100_000_000) {
    return `${formatNumber(normalized / 1e4, 0, true)}万`;
  }
  if (magnitude < 1_000_000_000) {
    return `${formatNumber(normalized / 1e8, 2, true)}亿`;
  }
  return `${formatNumber(normalized / 1e8, 1, true)}亿`;
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
