/**
 * 筛选器声明:页面级筛选状态 (Filter State) 的 DSL 形态。
 * 页面声明若干筛选器构成共享筛选状态;query 页面数据源通过 query.filters.subscribe 订阅,
 * 组件 action 经 writeFilter 回写。联动只通过筛选状态传递,组件间不直接连线。
 *
 * 闭集六类(ADR-0050):dimension / timeRange / timePoint / boolean / numberRange / search。
 * 维度筛选器可声明层级与级联;timeRange.default 可使用结构化相对时间(ADR-0035)。
 */
export type FilterDeclaration =
  | DimensionFilterDeclaration
  | TimeRangeFilterDeclaration
  | TimePointFilterDeclaration
  | BooleanFilterDeclaration
  | NumberRangeFilterDeclaration
  | SearchFilterDeclaration;

export interface FilterHierarchyLevel {
  id: string;
  /** 该级对应的数据服务维度 code;谓词按当前层级取字段。 */
  dimension: string;
  label?: string;
}

/** 维度筛选器:约束某个维度的取值集合 */
export interface DimensionFilterDeclaration {
  id: string;
  type: 'dimension';
  /** 约束的维度 code,引用数据服务定义的维度;候选值由运行时经数据网关查询 */
  dimension: string;
  /** 筛选器标签,显示于筛选器区 */
  label?: string;
  /**
   * 展示形态,四种共用同一纯渲染契约(候选项/当前值进、变更事件出):
   * select=下拉多选(默认)| tabs=tab 单选 | tree=树形多选(层级按候选值的 '/' 分隔符约定)
   * | search=输入过滤 + 多选
   */
  display?: 'select' | 'tabs' | 'tree' | 'search';
  /** false 时仅作为组件联动使用，不在页面筛选器区呈现控件。 */
  visible?: boolean;
  /** 初始选中的维度值;缺省为不筛选 */
  default?: string[];
  /**
   * 有序层级。取值同时携带选中值与所在层级;层级是查询谓词选字段
   * 与地图当前视角的唯一来源。至少两级。
   */
  hierarchy?: FilterHierarchyLevel[];
  /** 缺省选中的层级 id;省略则取 hierarchy 第一级。 */
  defaultLevel?: string;
  /**
   * 级联:依赖另一个筛选器,候选值按上游当前值收窄。
   * 不改变下游绑定字段,也不让下游出现或消失。只允许依赖一个上游。
   */
  dependsOn?: string;
}

/** 时间范围筛选器:约束查询的时间范围 */
export interface TimeRangeFilterDeclaration {
  id: string;
  type: 'timeRange';
  /** 筛选器标签,显示于筛选器区 */
  label?: string;
  /** 时间精度:date=日期(默认)| datetime=日期时间 */
  precision?: TimeRangePrecision;
  /** false 时仅作为组件联动使用，不在页面筛选器区呈现控件。 */
  visible?: boolean;
  /** 初始范围:相对预设、结构化相对时间或绝对范围;缺省为不筛选 */
  default?: TimeRangePreset | TimeRangeValue | RelativeTimeExpression;
}

export type TimeRangePrecision = 'date' | 'datetime';

/** 相对时间预设,由运行时在筛选状态初始化时解析为绝对范围 */
export type TimeRangePreset = 'today' | 'last7d' | 'last30d' | 'last90d';

/** 时间范围值:闭区间;date 精度为 YYYY-MM-DD,datetime 精度为 YYYY-MM-DDTHH:mm */
export interface TimeRangeValue {
  from: string;
  to: string;
}

export type RelativeTimeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type RelativeTimeRange =
  | { kind: 'lastN'; n: number }
  | { kind: 'previousComplete' }
  | { kind: 'currentToDate' };

/**
 * 结构化相对时间表达(ADR-0035):粒度单位 + 区间描述 + 锚点 + 是否包含
 * 当前未完成周期。它是声明式数据,不是表达式字符串。
 *
 * `includeCurrent` 必须显式声明。它对 `lastN` 生效:为真时当前未完成周期
 * 计入 N 个单位之一;为假时区间止于上一完整周期。`previousComplete` 与
 * `currentToDate` 忽略该字段,但仍要求写出,避免默认口径靠推断。
 *
 * 周从周一起算(ISO 8601)。季按自然年:Q1=1–3 月,Q2=4–6 月,Q3=7–9 月,Q4=10–12 月。
 */
export interface RelativeTimeExpression {
  unit: RelativeTimeUnit;
  range: RelativeTimeRange;
  includeCurrent: boolean;
  /** 求值锚点,YYYY-MM-DD;省略则取页面打开时刻的本地日期。 */
  anchor?: string;
}

export interface TimePointFilterDeclaration {
  id: string;
  type: 'timePoint';
  label?: string;
  visible?: boolean;
  /** 单个时间点的粒度。谓词是等值,不是区间。 */
  granularity: 'month' | 'date';
  /** month 为 YYYY-MM,date 为 YYYY-MM-DD */
  default?: string;
}

export interface BooleanFilterDeclaration {
  id: string;
  type: 'boolean';
  label?: string;
  visible?: boolean;
  /** true 表示打开时勾选;未勾选不占位(无条件)。 */
  default?: boolean;
}

export interface NumberRangeValue {
  from?: number;
  to?: number;
}

export interface NumberRangeFilterDeclaration {
  id: string;
  type: 'numberRange';
  label?: string;
  visible?: boolean;
  default?: NumberRangeValue;
}

export interface SearchFilterDeclaration {
  id: string;
  type: 'search';
  label?: string;
  visible?: boolean;
  default?: string;
}

export interface CalendarTimeRangeIssue {
  /** 单端点错误定位到具体字段;区间或精度一致性错误定位到范围整体 */
  field: 'from' | 'to' | null;
  message: string;
}

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
  const { from, to } = rangeFor(expression, anchor, now);
  if (precision === 'datetime') {
    const toIsToday = sameLocalDay(to, now);
    return {
      from: `${toLocalDate(from)}T00:00`,
      to: toIsToday ? `${toLocalDate(to)}T${toLocalTime(now)}` : `${toLocalDate(to)}T23:59`
    };
  }
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
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const datetimeMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const precision = datetimeMatch ? 'datetime' : dateMatch ? 'date' : undefined;
  const match = datetimeMatch ?? dateMatch;

  if (!match || (requiredPrecision !== undefined && precision !== requiredPrecision)) {
    return { valid: false, reason: 'format', precision };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
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
    precision === 'datetime'
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
  granularity: 'month' | 'date'
): string | undefined {
  if (granularity === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) return '时间点须为 YYYY-MM 格式';
    const month = Number(match[2]);
    if (month < 1 || month > 12) return '时间点不是有效月份';
    return undefined;
  }
  const parsed = parseCalendarValue(value, 'date');
  if (parsed.valid) return undefined;
  return parsed.reason === 'calendar' ? '时间点不是有效的公历日期' : '时间点须为 YYYY-MM-DD 格式';
}
