import { describe, expect, it } from 'vitest';
import { calendarDays, calendarDraft, calendarMonths, calendarValue, moveCalendarValue, shiftCalendar, validCalendarValue } from '../src/components/date-picker/calendar';

describe('日期选择器业务日期与提交边界', () => {
  it('闰年及月底严格校验，不把非法日期归一化', () => {
    expect(validCalendarValue('2024-02-29', 'date')).toBe(true);
    for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', 'bad']) {
      expect(validCalendarValue(value, 'date')).toBe(false);
    }
    expect(validCalendarValue('2026-12', 'month')).toBe(true);
    expect(validCalendarValue('2026-13', 'month')).toBe(false);
  });
  it('半范围及倒置范围无可应用值', () => {
    expect(calendarDraft('2026-01', '', 'month', true, false).ok).toBe(false);
    expect(calendarDraft('', '2026-06', 'month', true, false).ok).toBe(false);
    expect(calendarDraft('2026-06', '2026-01', 'month', true, false).ok).toBe(false);
    expect(calendarDraft('2026-02-29', '2026-03-01', 'date', true, false).ok).toBe(false);
  });
  it('同日及跨年完整范围提交原字符串', () => {
    expect(calendarDraft('2026-12', '2027-01', 'month', true, false)).toEqual({ ok: true, value: { from: '2026-12', to: '2027-01' } });
    expect(calendarDraft('2024-02-29', '2024-02-29', 'date', true, true)).toEqual({ ok: true, value: { from: '2024-02-29', to: '2024-02-29' } });
  });
  it('单值不依赖范围终点；required 不允许清空', () => {
    expect(calendarDraft('2026-01', '', 'month', false, true)).toEqual({ ok: true, value: { from: '2026-01', to: '2026-01' } });
    expect(calendarDraft('', '', 'date', false, true).ok).toBe(false);
    expect(calendarDraft('', '', 'date', true, true).ok).toBe(false);
    expect(calendarDraft('', '', 'date', true, false)).toEqual({ ok: true, value: null });
  });
  it('日历显示周日开头、相邻月份与闰日，42 个连续业务日期', () => {
    const rows = calendarDays({ year: 2024, month: 2 });
    expect(rows).toHaveLength(6);
    expect(rows.every(row => row.length === 7)).toBe(true);
    expect(rows[0][0]).toEqual({ value: '2024-01-28', label: 28, adjacent: 'pre-month' });
    expect(rows.flat().find(cell => cell.value === '2024-02-29')?.adjacent).toBe(null);
    expect(rows[5][6].value).toBe('2024-03-09');
    expect(new Set(rows.flat().map(cell => cell.value)).size).toBe(42);
  });
  it('翻页与键盘跨年/闰日不经过 UTC 序列化', () => {
    expect(shiftCalendar({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(moveCalendarValue('2026-12', 'month', 1)).toBe('2027-01');
    expect(moveCalendarValue('2024-02-28', 'date', 1)).toBe('2024-02-29');
    expect(moveCalendarValue('2024-02-29', 'date', 1)).toBe('2024-03-01');
    expect(calendarMonths(2027).flat().map(cell => cell.value)).toEqual(Array.from({ length: 12 }, (_, i) => `2027-${String(i + 1).padStart(2, '0')}`));
    expect(calendarValue(new Date(2026, 0, 31, 23, 59), 'date')).toBe('2026-01-31');
  });
});

import { calendarConformance } from '../fixtures/calendar-conformance';
it('中性日历的边界向量', () => { for (const [precision, value, valid] of calendarConformance) expect(validCalendarValue(value, precision)).toBe(valid); });

it('包含式下限阻止手工越界，月份与日期格式保持独立', () => {
  expect(calendarDraft('2020-05', '', 'month', false, true, '2020-06')).toEqual({ ok: false, error: '日期不得早于 2020-06' });
  expect(calendarDraft('2020-06', '', 'month', false, true, '2020-06').ok).toBe(true);
  expect(calendarDraft('2020-06-14', '', 'date', false, true, '2020-06-15').ok).toBe(false);
  expect(calendarDraft('2020-06-15', '', 'date', false, true, '2020-06-15').ok).toBe(true);
});

it('包含式上限阻止未来月份及日期，当前期间和范围终点均校验', () => {
  expect(calendarDraft('2026-10', '', 'month', false, true, undefined, '2026-10').ok).toBe(true);
  expect(calendarDraft('2026-11', '', 'month', false, true, undefined, '2026-10')).toEqual({ ok: false, error: '日期不得晚于 2026-10' });
  expect(calendarDraft('2026-10-16', '', 'date', false, true, undefined, '2026-10-15').ok).toBe(false);
  expect(calendarDraft('2026-09', '2026-11', 'month', true, true, undefined, '2026-10').ok).toBe(false);
});

it('年季值与键盘移动严格使用期间编码',()=>{
  expect(calendarValue(new Date(2026,9,15),'quarter')).toBe('2026-Q4');
  expect(calendarValue(new Date(2026,9,15),'year')).toBe('2026');
  expect(moveCalendarValue('2026-Q4','quarter',1)).toBe('2027-Q1');
  expect(moveCalendarValue('2026','year',-1)).toBe('2025');
  expect(calendarDraft('2026-Q4','','quarter',false,true)).toMatchObject({ok:true,value:{from:'2026-Q4',to:'2026-Q4'}});
  expect(validCalendarValue('2026-Q5','quarter')).toBe(false);
});
import {calendarBound,calendarSpan,calendarExclusion} from '../src/components/date-picker/calendar';
it('projects caps to navigation precision but checks whole natural spans',()=>{
 expect(calendarBound('2026-10-19','quarter',true)).toBe('2026-Q4');expect(calendarSpan('2026-Q4','quarter').to).toBe('2026-12-31');expect(calendarBound('2026-10','date',true)).toBe('2026-10-31');expect(calendarSpan('2024-02','month').to).toBe('2024-02-29');
});
it('detects a blocked date inside a range and within a larger natural period',()=>{
 const blocked=[{from:'2026-07-15',to:'2026-07-16'}];expect(calendarExclusion({from:'2026-07-01',to:'2026-08-01'},'date',blocked)).toBe(true);expect(calendarExclusion({from:'2026-Q3',to:'2026-Q3'},'quarter',blocked)).toBe(true);expect(calendarExclusion({from:'2026-08',to:'2026-09'},'month',blocked)).toBe(false);
});
