import { describe, expect, it } from 'vitest';
import type { ComputeOperator, DataRow, TimeFillOperator } from '@metriccanvas/page/internal';
import type { Page } from '@metriccanvas/page';
import { applyComputation } from '../src/compute';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import { createFilterState } from '../src/filter-state';
import type { ComputationContext } from '../src/compute/time-fill';
const context: ComputationContext = { currentYear: 2026, modes: new Map(), ranges: new Map() };
const fill: TimeFillOperator = { op: 'timeFill', timeField: 'month', granularity: 'month', format: 'compact', range: { from: '202501', to: '202503' }, measures: ['amount'] };
const run = (op: ComputeOperator, rows: DataRow[], ctx = context) => applyComputation([op], rows, new Map(), ctx);

describe('IOC F3 日历与有限字段模式', () => {
  it('乱序按日历补齐，缺月为null，负值与0保留，输入不变', () => {
    const rows = [{ month: '202503', amount: -20 }, { month: '202501', amount: 0 }];
    expect(run(fill, rows)).toEqual([{ month: '202501', amount: 0 }, { month: '202502', amount: null }, { month: '202503', amount: -20 }]);
    expect(rows[0].month).toBe('202503');
  });
  it('T-55 按固定系统2026年补12月，只有2025输入时本年全空', () => {
    const op: TimeFillOperator = { ...fill, range: { currentYearOffset: 0 } };
    const rows = run(op, [{ month: '202501', amount: 80 }]);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ month: '202601', amount: null });
    expect(rows.every(row => row.amount === null)).toBe(true);
    expect(run(op, [{ month: '202601', amount: 100 }])[0].amount).toBe(100);
    expect(run({ ...op, range: { currentYearOffset: -1 } }, [{ month: '202501', amount: 80 }])[0].amount).toBe(80);
  });
  it('闰日与跨年按日历补齐，不用日期字符串相加', () => {
    const op: TimeFillOperator = { ...fill, granularity: 'day', range: { from: '20240228', to: '20240301' } };
    expect(run(op, []).map(r => r.month)).toEqual(['20240228', '20240229', '20240301']);
    expect(run({ ...op, format: 'iso', range: { from: '2025-12-31', to: '2026-01-01' } }, []).map(r => r.month)).toEqual(['2025-12-31', '2026-01-01']);
  });
  it('拒绝重复月、非法日历和反向窗口', () => {
    expect(() => run(fill, [{ month: '202501', amount: 1 }, { month: '202501', amount: 2 }])).toThrow('重复');
    expect(() => run({ ...fill, granularity: 'day', range: { from: '20250229', to: '20250301' } }, [])).toThrow('非法');
    expect(() => run({ ...fill, range: { from: '202503', to: '202501' } }, [])).toThrow('有序');
  });
  it('组合分组逐组补齐，空组不造业务维度值', () => {
    expect(run({ ...fill, groupBy: ['customer'] }, [{ customer: 'A', month: '202501', amount: 1 }, { customer: 'B', month: '202503', amount: 2 }])).toHaveLength(6);
    expect(run({ ...fill, groupBy: ['customer'] }, [])).toEqual([]);
  });
  it('明确筛选窗口与系统当前年互不替代', () => {
    const ctx = { ...context, ranges: new Map([['period', { from: '2025-01-01', to: '2025-03-31' }]]) };
    expect(run({ ...fill, range: { filter: 'period' } }, [], ctx).map(r => r.month)).toEqual(['202501', '202502', '202503']);
    expect(() => run({ ...fill, range: { filter: 'period' } }, [])).toThrow('缺少');
  });
  it('近7日与近30日的字段选择不回退，未知或多选模式报错', () => {
    const op: ComputeOperator = { op: 'selectField', filter: 'mode', cases: { seven_day: 'seven', thirty_day: 'thirty' }, defaultMode: 'seven_day', output: 'previous' };
    expect(run(op, [{ seven: 120, thirty: 100 }])[0].previous).toBe(120);
    const ctx = { ...context, modes: new Map([['mode', ['thirty_day']]]) };
    expect(run(op, [{ seven: 120, thirty: 100 }], ctx)[0].previous).toBe(100);
    expect(run(op, [{ thirty: 100 }])[0].previous).toBeNull();
    expect(() => run(op, [], { ...context, modes: new Map([['mode', ['unknown']]]) })).toThrow('闭集');
    expect(() => run(op, [], { ...context, modes: new Map([['mode', ['seven_day', 'thirty_day']]]) })).toThrow('单选');
  });
  it('inline 模式切换经过正式快照链，不发起查询，比较值和比率同批变化', () => {
    const page: Page = { schemaVersion: '6.12', id: 'mode', filters: [{ id: 'mode', type: 'dimension', dimension: 'mode' }], dataSources: { data: {
      fields: Object.fromEntries(['current', 'seven', 'thirty', 'previous', 'gap', 'rate'].map(id => [id, { type: 'number', role: 'measure' }])),
      source: { type: 'inline', rows: [{ current: 150, seven: 120, thirty: 100 }] }, compute: [
        { op: 'selectField', filter: 'mode', cases: { seven_day: 'seven', thirty_day: 'thirty' }, defaultMode: 'seven_day', output: 'previous' },
        { op: 'delta', minuend: 'current', subtrahend: 'previous', output: 'gap' },
        { op: 'ratio', numerator: 'gap', denominator: 'previous', output: 'rate', onZeroDenominator: 'null', scale: 100 }
      ] } }, sections: [{ id: 'main', components: [{ id: 'table', type: 'table', layout: { span: 12 }, data: { main: 'data' }, props: { columns: [{ field: 'rate' }] } }] }] };
    const filters = createFilterState(new Map());
    let state: PageDataSnapshots = new Map();
    const stop = orchestrate(page, { async fetchData() { throw Error('不应请求'); } }, filters).subscribe(next => state = next);
    expect(state.get('data')).toMatchObject({ status: 'ready', rows: [{ previous: 120, rate: 25 }] });
    filters.write('mode', { type: 'dimension', dimension: 'mode', values: ['thirty_day'] });
    expect(state.get('data')).toMatchObject({ status: 'ready', rows: [{ previous: 100, rate: 50 }] });
    stop();
  });
});
