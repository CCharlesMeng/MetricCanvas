import type { FieldValue, ValueFormat, ValueFormatPreset } from '@metriccanvas/page/internal';
import { formatPeriod } from '@metriccanvas/page/internal';
import { formatTime } from './time-format';
import { formatAdaptiveMoney } from './adaptive-money-format';
import { adaptiveNumericText } from './numeric-presentation';
import { mobilePresentation } from './presentation-environment';

export type ValuePolarity = 'positive' | 'negative' | 'neutral';
type SignedNumberFormat = Extract<ValueFormat, `number${string}-signed`>;

export const DEFAULT_NULL_TEXT = '--';
export interface ValueFormatContext { unit?: string; mobile?: boolean }

/** 是否呈现真实值；0、false 和恰好等于缺省文案的文本均有效。 */
export function hasDisplayValue(value: FieldValue | undefined): value is NonNullable<FieldValue> {
  return value != null && (typeof value !== 'number' || Number.isFinite(value));
}

/**
 * 将数据快照中的原始值翻译为展示文本。
 * 百分比值沿用数据服务约定:4.24 表示 4.24%,不在组件侧乘 100。
 */
export function formatValue(
  value: FieldValue | undefined,
  format?: ValueFormat,
  missingText = DEFAULT_NULL_TEXT,
  context: ValueFormatContext = {}
): string {
  if (!hasDisplayValue(value)) return missingValueText(missingText);
  if (!format || format === 'text') return String(value);
  if (typeof format === 'object') return formatTime(value, format);
  if (format === 'period') return formatPeriod(String(value));
  if (format === 'date') return formatDate(value);
  if (format === 'date-month-day') {
    const date = formatDate(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : date;
  }

  const numeric = finiteNumber(value);
  if (numeric === undefined) return String(value);

  return formatNumericValue(numeric, format, context);
}

function missingValueText(text: string): string {
  return ['--', '- -', '—', '–', '-', '--%', '- -%'].includes(text) ? DEFAULT_NULL_TEXT : text;
}

function formatNumericValue(numeric: number, format: ValueFormatPreset, context: ValueFormatContext): string {
  const adaptive = adaptiveNumericText(numeric, format, context.unit, context.mobile ?? mobilePresentation());
  if (adaptive !== undefined) return adaptive;
  if (format === 'percent-raw') return `${numeric}%`;
  if (format === 'yoy-p-signed') return yoyPresentation(numeric).text;
  if (format === 'points-1-signed') return `${signedNumberPresentation(numeric, 'number-1-signed').text}P`;
  const percent = /^percent-([012])(-signed)?$/.exec(format);
  if (percent) return `${percent[2] && numeric > 0 ? '+' : ''}${formatNumber(numeric, Number(percent[1]))}%`;
  return formatStandardNumber(numeric, format);
}

function formatStandardNumber(numeric: number, format: ValueFormatPreset): string {
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
    case 'cny-adaptive-trimmed':
    case 'cny-adaptive-trimmed-no-yuan':
    case 'usd-adaptive-km':
      return formatAdaptiveMoney(numeric, format);
    default: return formatCompactNumber(numeric, format);
  }
}

/** 新增 signed 数值格式按展示精度判断方向；其它格式仍按原始值。 */
export function valuePolarity(
  value: FieldValue | undefined,
  format?: ValueFormat
): ValuePolarity {
  const numeric = finiteNumber(value);
  if (numeric === undefined || numeric === 0) return 'neutral';
  if (format === 'yoy-p-signed') return yoyPresentation(numeric).polarity;
  if (format === 'points-1-signed') return signedNumberPresentation(numeric, 'number-1-signed').polarity;
  if (isSignedNumberFormat(format)) return signedNumberPresentation(numeric, format).polarity;
  return numeric > 0 ? 'positive' : 'negative';
}

/** 同比先按两位小数舍入，再乘100；最后的整数格式消除二进制乘法尾数。 */
function yoyPresentation(value: number) {
  const rounded = signedNumberPresentation(value, 'number-2-signed');
  const magnitude = formatNumber(Number(rounded.text) * 100, 0);
  return { text: `${rounded.polarity === 'positive' ? '+' : ''}${magnitude}P`, polarity: rounded.polarity };
}

export function isSignedNumberFormat(
  format: ValueFormat | undefined
): format is SignedNumberFormat {
  return typeof format === 'string' && format.startsWith('number') && format.endsWith('-signed');
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
          minimumFractionDigits: 0,
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

function formatCompactNumber(numeric: number, format: ValueFormatPreset): string {
  switch (format) {
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
    default: return String(numeric);
  }
}
