
export type CalendarPrecision = 'month' | 'date';
export interface CalendarView { year: number; month: number }
export interface CalendarCell { value: string; label: number; adjacent: 'pre-month' | 'next-month' | null }
const pad = (value: number) => String(value).padStart(2, '0');

/** Calendar values are business dates, never UTC instants. */
export function calendarValue(date: Date, precision: CalendarPrecision): string {
  const month = `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}`;
  return precision === 'month' ? month : `${month}-${pad(date.getDate())}`;
}
export function validCalendarValue(value: string, precision: CalendarPrecision): boolean {
  return calendarValueError(value, precision, 'from') === undefined;
}
export function calendarView(value: string, today = new Date()): CalendarView {
  return { year: Number(value.slice(0, 4)) || today.getFullYear(), month: Number(value.slice(5, 7)) || today.getMonth() + 1 };
}
export function shiftCalendar(view: CalendarView, months: number): CalendarView {
  const index = view.year * 12 + view.month - 1 + months;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 };
}
function localDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}
export function calendarDays(view: CalendarView): CalendarCell[][] {
  const weekday = localDate(view.year, view.month, 1).getDay();
  // Tiny includes the previous week's Sunday when the month begins on Sunday.
  const offset = weekday || 7;
  return Array.from({ length: 6 }, (_, row) => Array.from({ length: 7 }, (_, col) => {
    const date = localDate(view.year, view.month, row * 7 + col + 1 - offset);
    const value = calendarValue(date, 'date');
    const viewMonth = `${view.year}-${pad(view.month)}`;
    return { value, label: date.getDate(), adjacent: value.slice(0, 7) < viewMonth ? 'pre-month' : value.slice(0, 7) > viewMonth ? 'next-month' : null };
  }));
}
export function calendarMonths(year: number): CalendarCell[][] {
  return Array.from({ length: 3 }, (_, row) => Array.from({ length: 4 }, (_, col) => {
    const month = row * 4 + col + 1;
    return { value: `${String(year).padStart(4, '0')}-${pad(month)}`, label: month, adjacent: null };
  }));
}
export function moveCalendarValue(value: string, precision: CalendarPrecision, amount: number): string {
  const view = calendarView(value);
  return calendarValue(localDate(view.year, view.month + (precision === 'month' ? amount : 0), precision === 'date' ? Number(value.slice(8)) + amount : 1), precision);
}
export function calendarDraft(from: string, to: string, precision: CalendarPrecision, range: boolean, required: boolean):
  { ok: true; value: { from: string; to: string } | null } | { ok: false; error: string } {
  if (!from && (!range || !to)) return required ? { ok: false, error: '请选择日期' } : { ok: true, value: null };
  if (range && (!from || !to)) return { ok: false, error: '请填写完整的起止期间' };
  const value = { from, to: range ? to : from };
  const error = calendarValueError(from, precision, 'from') ?? calendarValueError(value.to, precision, 'to') ?? (from > value.to ? '时间范围 from 不得晚于 to' : undefined);
  return error ? { ok: false, error } : { ok: true, value };
}

/** Strict neutral Gregorian date validation, independent of Page Metadata. */
function calendarValueError(value: string, precision: CalendarPrecision, field: 'from' | 'to'): string | undefined {
  const match = (precision === 'month' ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/).exec(value);
  if (!match) return `时间范围 ${field} 须为 ${precision === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'} 格式`;
  const year = Number(match[1]), month = Number(match[2]), day = precision === 'month' ? 1 : Number(match[3]);
  const days = month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days) return `时间范围 ${field} 不是有效的公历日期`;
  return undefined;
}
