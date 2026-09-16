/** 时间输入精度不等于结果分组粒度或指标统计周期。 */
export type TimeParamGranularity = 'month' | 'date';
export type TimeWindow =
  | { kind: 'period'; unit: 'day' | 'month' | 'year'; offset?: number }
  | { kind: 'lastN'; unit: 'day' | 'month'; n: number }
  | { kind: 'yearToDate' | 'monthToDate' }
  | { kind: 'toDate'; unit: 'month' | 'year' };

/** 只接受 0001—9999 年的规范日历值，UTC 仅用于日历算术，不代表业务时区。 */
export function matchesTimeValue(value: unknown, granularity: TimeParamGranularity | undefined): value is string {
  if (typeof value !== 'string') return false;
  const pattern = granularity === 'month' ? /^\d{4}-\d{2}$/ : granularity === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : undefined;
  if (!pattern?.test(value)) return false;
  const [year, month, day = 1] = value.split('-').map(Number);
  const date = calendarDate(year, month, day);
  return year >= 1 && year <= 9999 && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function timeWindowCompatible(granularity: TimeParamGranularity, window: TimeWindow): boolean {
  if (window.kind === 'lastN') return window.unit === (granularity === 'month' ? 'month' : 'day');
  return window.kind !== 'period' || granularity !== 'month' || window.unit !== 'day';
}

/** 起止包含；不访问系统时钟，不查询最新期，不改变指标口径。 */
export function resolveTimeWindow(value: string, window: TimeWindow): { start: string; end: string } {
  const granularity = value.length === 7 ? 'month' : 'date';
  if (!matchesTimeValue(value, granularity) || !timeWindowCompatible(granularity, window)) throw new Error('时间参数或窗口精度不合法');
  const [year, month, day = 1] = value.split('-').map(Number);
  let start = calendarDate(year, month, day);
  let end = calendarDate(year, month, day);
  if (window.kind === 'period') {
    const offset = window.offset ?? 0;
    if (!Number.isSafeInteger(offset)) throw new Error('周期偏移必须为安全整数');
    if (window.unit === 'year') {
      start = calendarDate(year + offset, 1, 1);
      end = calendarDate(year + offset + 1, 1, 0);
    } else if (window.unit === 'month') {
      start = calendarDate(year, month + offset, 1);
      end = calendarDate(year, month + offset + 1, 0);
    } else {
      start = end = calendarDate(year, month, day + offset);
    }
  } else if (window.kind === 'lastN') {
    if (!Number.isSafeInteger(window.n) || window.n < 1) throw new Error('滚动周期数量必须为正安全整数');
    start = window.unit === 'month' ? calendarDate(year, month - window.n + 1, 1) : calendarDate(year, month, day - window.n + 1);
  } else {
    start = calendarDate(year, (window.kind === 'yearToDate' || (window.kind === 'toDate' && window.unit === 'year')) ? 1 : month, 1);
  }
  return { start: serialize(start, granularity), end: serialize(end, granularity) };
}

function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function serialize(date: Date, granularity: TimeParamGranularity): string {
  const year = date.getUTCFullYear();
  if (!Number.isFinite(year) || year < 1 || year > 9999) throw new Error('时间窗口超出 0001—9999 年范围');
  const result = `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return granularity === 'month' ? result : `${result}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
