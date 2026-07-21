/**
 * 筛选器声明:页面级筛选状态 (Filter State) 的 DSL 形态。
 * 页面声明若干筛选器构成共享筛选状态;query 页面数据源通过 query.filters.subscribe 订阅,
 * 组件 action 经 writeFilter 回写。联动只通过筛选状态传递,组件间不直接连线。
 */
export type FilterDeclaration = DimensionFilterDeclaration | TimeRangeFilterDeclaration;

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
  /** 初始选中的维度值;缺省为不筛选 */
  default?: string[];
}

/** 时间范围筛选器:约束查询的时间范围 */
export interface TimeRangeFilterDeclaration {
  id: string;
  type: 'timeRange';
  /** 筛选器标签,显示于筛选器区 */
  label?: string;
  /** 时间精度:date=日期(默认)| datetime=日期时间 */
  precision?: TimeRangePrecision;
  /** 初始范围:相对预设(按打开时刻解析)或绝对范围;缺省为不筛选 */
  default?: TimeRangePreset | TimeRangeValue;
}

export type TimeRangePrecision = 'date' | 'datetime';

/** 相对时间预设,由运行时在筛选状态初始化时解析为绝对范围 */
export type TimeRangePreset = 'today' | 'last7d' | 'last30d' | 'last90d';

/** 时间范围值:闭区间;date 精度为 YYYY-MM-DD,datetime 精度为 YYYY-MM-DDTHH:mm */
export interface TimeRangeValue {
  from: string;
  to: string;
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
  const datetimeMatch =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
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

function daysInGregorianMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
