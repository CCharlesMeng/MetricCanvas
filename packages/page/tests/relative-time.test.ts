import { describe, expect, it } from 'vitest';
import { resolveRelativeTime } from '../src/filter';

const now = new Date(2026, 6, 20, 9, 5); // 2026-07-20 09:05 本地

describe('结构化相对时间求值', () => {
  it('lastN 月含当前未完成周期：近 6 个月含 7 月', () => {
    expect(
      resolveRelativeTime(
        { unit: 'month', range: { kind: 'lastN', n: 6 }, includeCurrent: true },
        now
      )
    ).toEqual({ from: '2026-02-01', to: '2026-07-20' });
  });

  it('lastN 月不含当前周期：近 6 个完整月止于 6 月', () => {
    expect(
      resolveRelativeTime(
        { unit: 'month', range: { kind: 'lastN', n: 6 }, includeCurrent: false },
        now
      )
    ).toEqual({ from: '2026-01-01', to: '2026-06-30' });
  });

  it('上一个完整季度是 4–6 月', () => {
    expect(
      resolveRelativeTime(
        { unit: 'quarter', range: { kind: 'previousComplete' }, includeCurrent: false },
        now
      )
    ).toEqual({ from: '2026-04-01', to: '2026-06-30' });
  });

  it('本周至今从周一起算', () => {
    expect(
      resolveRelativeTime(
        { unit: 'week', range: { kind: 'currentToDate' }, includeCurrent: true },
        now
      )
    ).toEqual({ from: '2026-07-20', to: '2026-07-20' });
  });

  it('固定锚点可复现历史区间', () => {
    expect(
      resolveRelativeTime(
        {
          unit: 'month',
          range: { kind: 'previousComplete' },
          includeCurrent: false,
          anchor: '2026-03-15'
        },
        now
      )
    ).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('datetime 精度在含当天时终点取求值时刻', () => {
    expect(
      resolveRelativeTime(
        { unit: 'day', range: { kind: 'lastN', n: 1 }, includeCurrent: true },
        now,
        'datetime'
      )
    ).toEqual({ from: '2026-07-20T00:00', to: '2026-07-20T09:05' });
  });
});
