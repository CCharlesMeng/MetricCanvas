import type { DataRow, TimeFillOperator } from '@metriccanvas/page/internal';
import { ComputationError } from './join-aggregate';

export interface ComputationContext {
  /** 同一页面会话的日历锚点，不在算子中读取时钟。 */
  currentYear: number;
  modes: ReadonlyMap<string, readonly string[]>;
  ranges: ReadonlyMap<string, { from: string; to: string }>;
}

export function timeFill(operator: TimeFillOperator, rows: readonly DataRow[], context?: ComputationContext): DataRow[] {
  const month = operator.granularity === 'month';
  const parse = (value: unknown): number => {
    if (typeof value !== 'string') throw new ComputationError('补齐时间字段必须是规范日期字符串');
    const pattern = operator.format === 'compact' ? (month ? /^(\d{4})(\d{2})$/ : /^(\d{4})(\d{2})(\d{2})$/)
      : (month ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/);
    const parts = pattern.exec(value);
    if (!parts) throw new ComputationError('补齐时间字段格式不合法');
    const year = Number(parts[1]); const m = Number(parts[2]); const day = Number(parts[3] ?? 1);
    const date = new Date(0); date.setUTCFullYear(year, m - 1, day); date.setUTCHours(0, 0, 0, 0);
    if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== day) throw new ComputationError('补齐时间字段包含非法日历日期');
    return month ? year * 12 + m - 1 : date.getTime() / 86400000;
  };
  const format = (index: number): string => {
    const date = month ? undefined : new Date(index * 86400000);
    const year = month ? Math.floor(index / 12) : date!.getUTCFullYear();
    const m = month ? index % 12 + 1 : date!.getUTCMonth() + 1;
    const separator = operator.format === 'iso' ? '-' : '';
    return `${String(year).padStart(4, '0')}${separator}${String(m).padStart(2, '0')}${month ? '' : separator + String(date!.getUTCDate()).padStart(2, '0')}`;
  };
  let from: number; let to: number;
  if ('currentYearOffset' in operator.range) {
    if (!context) throw new ComputationError('缺少补齐日历锚点');
    const year = context.currentYear + operator.range.currentYearOffset;
    if (!Number.isInteger(year) || year < 1 || year > 9999) throw new ComputationError('补齐日历锚点不合法');
    const sep = operator.format === 'iso' ? '-' : '';
    from = parse(`${year}${sep}01${month ? '' : sep + '01'}`);
    to = parse(`${year}${sep}12${month ? '' : sep + '31'}`);
  } else if ('filter' in operator.range) {
    const range = context?.ranges.get(operator.range.filter);
    if (!range) throw new ComputationError('时间补齐缺少有效筛选范围');
    const adapt = (value: string) => (month ? value.slice(0, 7) : value).replaceAll('-', operator.format === 'iso' ? '-' : '');
    from = parse(adapt(range.from)); to = parse(adapt(range.to));
  } else { from = parse(operator.range.from); to = parse(operator.range.to); }
  if (from > to || to - from >= 3660) throw new ComputationError('补齐范围必须有序且不超过3660期');
  const groupFields = operator.groupBy ?? [];
  const groups = new Map<string, { keys: DataRow; periods: Map<number, DataRow> }>();
  if (!groupFields.length) groups.set('[]', { keys: {}, periods: new Map() });
  for (const row of rows) {
    const index = parse(row[operator.timeField]);
    const values = groupFields.map(field => {
      const value = row[field];
      if (value == null || Array.isArray(value) || (typeof value === 'number' && !Number.isFinite(value))) throw new ComputationError('补齐分组键缺失或不合法');
      return value;
    });
    const id = JSON.stringify(values);
    const group = groups.get(id) ?? { keys: Object.fromEntries(groupFields.map((field, i) => [field, values[i]])), periods: new Map<number, DataRow>() };
    if (group.periods.has(index)) throw new ComputationError('补齐输入存在重复分组期间');
    group.periods.set(index, row); groups.set(id, group);
  }
  if (groups.size * (to - from + 1) > 100000) throw new ComputationError('补齐结果超过100000行');
  const blank = Object.fromEntries([...new Set([...operator.measures, ...rows.flatMap(row => Object.keys(row))])].map(field => [field, null]));
  return [...groups.values()].flatMap(group => Array.from({ length: to - from + 1 }, (_, offset) => {
    const index = from + offset;
    return { ...(group.periods.get(index) ?? blank), ...group.keys, [operator.timeField]: format(index) };
  }));
}
