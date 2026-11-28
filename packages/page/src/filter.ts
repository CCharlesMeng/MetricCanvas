import { evaluationTimeValue, type TemporalEvaluation } from './temporal-evaluation';
import type {
  BooleanFilterDeclaration,
  CalendarTimeRangeIssue,
  DimensionDefaultCondition,
  DimensionFilterDeclaration,
  DimensionSelectionExtension,
  FilterDeclaration,
  FilterHierarchyLevel,
  FilterInteractionExtension,
  NumberRangeFilterDeclaration,
  NumberRangeValue,
  RelativeTimeExpression,
  RelativeTimeRange,
  RelativeTimeUnit,
  SearchFilterDeclaration,
  TimeAvailability,
  TimePointFilterDeclaration,
  TimeRangeFilterDeclaration,
  TimeRangePrecision,
  TimeRangePreset,
  TimeRangeValue,
} from './filter-types';

export type {
  BooleanFilterDeclaration,
  CalendarTimeRangeIssue,
  DimensionFilterDeclaration,
  DimensionSelectionExtension,
  FilterDeclaration,
  FilterHierarchyLevel,
  FilterInteractionExtension,
  NumberRangeFilterDeclaration,
  NumberRangeValue,
  RelativeTimeExpression,
  RelativeTimeRange,
  RelativeTimeUnit,
  SearchFilterDeclaration,
  TimeAvailability,
  TimePointFilterDeclaration,
  TimeRangeFilterDeclaration,
  TimeRangePrecision,
  TimeRangePreset,
  TimeRangeValue,
};

/**
 * 校验绝对时间范围的公历语义。
 * precision 指定时严格要求对应格式;省略时允许 date/datetime,但两端精度必须一致。
 */
export function validateCalendarTimeRange(
  range: TimeRangeValue,
  precision?: TimeRangePrecision
): CalendarTimeRangeIssue[] {
  const from = parseCalendarValue(range.from, precision);
  const to = parseCalendarValue(range.to, precision);
  const issues: CalendarTimeRangeIssue[] = [];

  if (!from.valid) {
    issues.push({ field: 'from', message: calendarValueMessage('from', from, precision) });
  }
  if (!to.valid) {
    issues.push({ field: 'to', message: calendarValueMessage('to', to, precision) });
  }
  if (!from.valid || !to.valid) return issues;

  if (from.precision !== to.precision) {
    return [
      {
        field: null,
        message: '时间范围 from 与 to 必须使用相同精度'
      }
    ];
  }
  if (range.from > range.to) {
    issues.push({
      field: null,
      message: '时间范围 from 不得晚于 to'
    });
  }
  return issues;
}

export function isRelativeTimeExpression(value: unknown): value is RelativeTimeExpression {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as RelativeTimeExpression;
  return (
    (candidate.unit === 'day' ||
      candidate.unit === 'week' ||
      candidate.unit === 'month' ||
      candidate.unit === 'quarter' ||
      candidate.unit === 'year') &&
    typeof candidate.range === 'object' &&
    candidate.range !== null &&
    typeof candidate.includeCurrent === 'boolean'
  );
}

export function isTimeRangeValue(value: unknown): value is TimeRangeValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as TimeRangeValue).from === 'string' &&
    typeof (value as TimeRangeValue).to === 'string'
  );
}

/** 当前层级声明;无层级时回落到筛选器自身的 dimension。 */
export function hierarchyLevelOf(
  declaration: DimensionFilterDeclaration,
  levelId?: string
): FilterHierarchyLevel | undefined {
  const hierarchy = declaration.hierarchy;
  if (!hierarchy || hierarchy.length === 0) return undefined;
  if (levelId) return hierarchy.find((level) => level.id === levelId);
  if (declaration.defaultLevel) {
    return hierarchy.find((level) => level.id === declaration.defaultLevel) ?? hierarchy[0];
  }
  return hierarchy[0];
}

export function dimensionOfLevel(
  declaration: DimensionFilterDeclaration,
  levelId?: string
): string {
  return hierarchyLevelOf(declaration, levelId)?.dimension ?? declaration.dimension;
}

/**
 * 求值结构化相对时间。一次页面加载内应共享同一个 `now`。
 * 输出格式跟随筛选器精度:date 为 YYYY-MM-DD,datetime 的终点在含当天时取 now 的时刻。
 */
export function resolveRelativeTime(
  expression: RelativeTimeExpression,
  now: Date,
  precision: TimeRangePrecision = 'date'
): TimeRangeValue {
  const anchor = expression.anchor ? parseAnchorDate(expression.anchor, now) : startOfLocalDay(now);
  const { from, to } = rangeFor(expression, anchor, expression.anchor?anchor:now);
  if (precision === 'datetime') {
    const toIsToday = sameLocalDay(to, now);
    return {
      from: `${toLocalDate(from)}T00:00`,
      to: toIsToday ? `${toLocalDate(to)}T${toLocalTime(now)}` : `${toLocalDate(to)}T23:59`
    };
  }
  if(precision==='month')return {from:toLocalDate(from).slice(0,7),to:toLocalDate(to).slice(0,7)};
  return { from: toLocalDate(from), to: toLocalDate(to) };
}

function rangeFor(
  expression: RelativeTimeExpression,
  anchor: Date,
  now: Date
): { from: Date; to: Date } {
  const { unit, range, includeCurrent } = expression;
  if (range.kind === 'previousComplete') {
    const previous = addUnits(startOfUnit(anchor, unit), unit, -1);
    return { from: previous, to: endOfUnit(previous, unit) };
  }
  if (range.kind === 'currentToDate') {
    return { from: startOfUnit(anchor, unit), to: startOfLocalDay(now) };
  }
  const n = range.n;
  if (includeCurrent) {
    const from = addUnits(startOfUnit(anchor, unit), unit, -(n - 1));
    return { from, to: startOfLocalDay(now) };
  }
  const lastComplete = addUnits(startOfUnit(anchor, unit), unit, -1);
  const from = addUnits(lastComplete, unit, -(n - 1));
  return { from, to: endOfUnit(lastComplete, unit) };
}

function parseAnchorDate(value: string, fallback: Date): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return startOfLocalDay(fallback);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInGregorianMonth(year, month)) {
    return startOfLocalDay(fallback);
  }
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfUnit(date: Date, unit: RelativeTimeUnit): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  if (unit === 'day') return new Date(year, month, day);
  if (unit === 'week') {
    const weekday = (date.getDay() + 6) % 7;
    return new Date(year, month, day - weekday);
  }
  if (unit === 'month') return new Date(year, month, 1);
  if (unit === 'quarter') return new Date(year, Math.floor(month / 3) * 3, 1);
  return new Date(year, 0, 1);
}

function endOfUnit(start: Date, unit: RelativeTimeUnit): Date {
  const next = addUnits(start, unit, 1);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
}

function addUnits(date: Date, unit: RelativeTimeUnit, count: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  if (unit === 'day') return new Date(year, month, day + count);
  if (unit === 'week') return new Date(year, month, day + count * 7);
  if (unit === 'month') return new Date(year, month + count, 1);
  if (unit === 'quarter') return new Date(year, month + count * 3, 1);
  return new Date(year + count, 0, 1);
}

function sameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function toLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

type ParsedCalendarValue =
  | { valid: true; precision: TimeRangePrecision }
  | { valid: false; reason: 'format' | 'calendar'; precision?: TimeRangePrecision };

function parseCalendarValue(
  value: unknown,
  requiredPrecision?: TimeRangePrecision
): ParsedCalendarValue {
  if (typeof value !== 'string') {
    return { valid: false, reason: 'format' };
  }
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(value);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const datetimeMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const precision = datetimeMatch ? 'datetime' : dateMatch ? 'date' : monthMatch ? 'month' : undefined;
  const match = datetimeMatch ?? dateMatch ?? monthMatch;

  if (!match || (requiredPrecision !== undefined && precision !== requiredPrecision)) {
    return { valid: false, reason: 'format', precision };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = monthMatch ? 1 : Number(match[3]);
  const hour = datetimeMatch ? Number(datetimeMatch[4]) : undefined;
  const minute = datetimeMatch ? Number(datetimeMatch[5]) : undefined;
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInGregorianMonth(year, month) ||
    (hour !== undefined && (hour > 23 || minute === undefined || minute > 59))
  ) {
    return { valid: false, reason: 'calendar', precision };
  }
  return { valid: true, precision: precision! };
}

function calendarValueMessage(
  field: 'from' | 'to',
  parsed: Exclude<ParsedCalendarValue, { valid: true }>,
  precision?: TimeRangePrecision
): string {
  if (parsed.reason === 'calendar') {
    return `时间范围 ${field} 不是有效的公历${parsed.precision === 'datetime' ? '日期时间' : '日期'}`;
  }
  const expected =
    precision === 'month' ? 'YYYY-MM' : precision === 'datetime'
      ? 'YYYY-MM-DDTHH:mm'
      : precision === 'date'
        ? 'YYYY-MM-DD'
        : 'YYYY-MM-DD 或 YYYY-MM-DDTHH:mm';
  return `时间范围 ${field} 须为 ${expected} 格式`;
}

export function daysInGregorianMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function validateTimePointValue(
  value: string,
  granularity: 'month' | 'date',
  min?: string,
  disableFuture = false,
  now?: Date,
  evaluation?: TemporalEvaluation
): string | undefined {
  if (granularity === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return '时间点须为 YYYY-MM 格式';
    const month = Number(match[2]);
    if (Number(match[1]) < 1 || month < 1 || month > 12) return '时间点不是有效月份';
  } else {
    const parsed = parseCalendarValue(value, 'date');
    if (!parsed.valid) return parsed.reason === 'calendar' ? '时间点不是有效的公历日期' : '时间点须为 YYYY-MM-DD 格式';
  }
  if (min !== undefined && value < min) return `时间点不得早于 ${min}`;
  if (disableFuture) {
    const maximum = timePointMaximum(granularity, now, evaluation);
    if (value > maximum) return granularity === 'month' ? '时间点不得晚于当前月份' : '时间点不得晚于当前日期';
  }
  return undefined;
}

function timePointMaximum(granularity: 'month' | 'date', now?: Date, evaluation?: TemporalEvaluation): string {
  if (evaluation) return evaluationTimeValue(granularity, evaluation);
  const clock = now ?? new Date();
  const month = `${String(clock.getFullYear()).padStart(4, '0')}-${String(clock.getMonth() + 1).padStart(2, '0')}`;
  return granularity === 'month' ? month : `${month}-${String(clock.getDate()).padStart(2, '0')}`;
}
