import { describe, expect, it } from 'vitest';
import {
  createFilterState,
  initialFilterValues,
  type FilterValue,
  type FilterValues
} from '../src/filter-state';

const region: FilterValue = { type: 'dimension', dimension: 'region', values: ['华东', '华南'] };
const june: FilterValue = { type: 'timeRange', from: '2026-06-01', to: '2026-06-30' };

/** 收集订阅推送,便于断言通知次数与内容 */
function collect(state: ReturnType<typeof createFilterState>) {
  const pushes: FilterValues[] = [];
  const unsubscribe = state.subscribe((values) => {
    pushes.push(values);
  });
  return { pushes, unsubscribe };
}

describe('筛选状态 store:订阅与回写', () => {
  it('subscribe 立即同步收到当前值(svelte store 契约)', () => {
    const state = createFilterState(new Map<string, FilterValue>([['f-region', region]]));
    const { pushes } = collect(state);
    expect(pushes).toHaveLength(1);
    expect(pushes[0].get('f-region')).toEqual(region);
  });

  it('write 后订阅者收到含新值的推送,且每次推送是新 Map 实例', () => {
    const state = createFilterState();
    const { pushes } = collect(state);
    state.write('f-time', june);
    expect(pushes).toHaveLength(2);
    expect(pushes[1].get('f-time')).toEqual(june);
    expect(pushes[1]).not.toBe(pushes[0]);
  });

  it('write(id, null) 清除该筛选器;空维度值数组等同清除', () => {
    const state = createFilterState(new Map<string, FilterValue>([['f-region', region], ['f-time', june]]));
    const { pushes } = collect(state);
    state.write('f-region', null);
    expect(pushes[1].has('f-region')).toBe(false);
    state.write('f-time', { type: 'dimension', dimension: 'x', values: [] });
    expect(pushes[2].has('f-time')).toBe(false);
  });

  it('写入与当前相同的值不重复通知(tab 重复点击不引起重查)', () => {
    const state = createFilterState(new Map<string, FilterValue>([['f-region', region]]));
    const { pushes } = collect(state);
    state.write('f-region', { type: 'dimension', dimension: 'region', values: ['华东', '华南'] });
    expect(pushes).toHaveLength(1);
  });

  it('退订后不再收到通知', () => {
    const state = createFilterState();
    const { pushes, unsubscribe } = collect(state);
    unsubscribe();
    state.write('f-region', region);
    expect(pushes).toHaveLength(1);
  });
});

describe('筛选状态 store:URL 序列化', () => {
  it('toURL → fromURL 往返完整还原(含中文、逗号、& 等特殊字符)', () => {
    const tricky: FilterValue = {
      type: 'dimension',
      dimension: 'channel',
      values: ['直营, 加盟', 'a&b=c']
    };
    const source = createFilterState(
      new Map<string, FilterValue>([['f-region', region], ['f-channel', tricky], ['f-time', june]])
    );
    const restored = createFilterState();
    restored.fromURL(source.toURL());
    const { pushes } = collect(restored);
    expect(pushes[0].get('f-region')).toEqual(region);
    expect(pushes[0].get('f-channel')).toEqual(tricky);
    expect(pushes[0].get('f-time')).toEqual(june);
    expect(pushes[0].size).toBe(3);
  });

  it('空筛选状态 toURL 为空字符串', () => {
    expect(createFilterState().toURL()).toBe('');
  });

  it('fromURL 只还原带类型标记的参数,忽略无关参数与畸形值,不抛出', () => {
    const state = createFilterState();
    state.fromURL('?foo=bar&f-region=d%3Aregion%3A%E5%8D%8E%E4%B8%9C&f-bad=d:仅有维度没有值段');
    const { pushes } = collect(state);
    expect(pushes[0].size).toBe(1);
    expect(pushes[0].get('f-region')).toEqual({
      type: 'dimension',
      dimension: 'region',
      values: ['华东']
    });
  });

  it('fromURL 以 URL 内容整体替换当前状态并通知订阅者', () => {
    const state = createFilterState(new Map<string, FilterValue>([['f-region', region]]));
    const { pushes } = collect(state);
    const other = createFilterState(new Map<string, FilterValue>([['f-time', june]]));
    state.fromURL(other.toURL());
    expect(pushes).toHaveLength(2);
    expect(pushes[1].has('f-region')).toBe(false);
    expect(pushes[1].get('f-time')).toEqual(june);
  });
});

describe('筛选状态初值:按页面 filters 声明初始化', () => {
  it('维度 default 与绝对时间范围 default 直接成为初值;无 default 的不占位', () => {
    const values = initialFilterValues([
      { id: 'f-region', type: 'dimension', dimension: 'region', default: ['华东'] },
      { id: 'f-channel', type: 'dimension', dimension: 'channel' },
      { id: 'f-time', type: 'timeRange', default: { from: '2026-01-01', to: '2026-03-31' } }
    ]);
    expect(values.get('f-region')).toEqual({
      type: 'dimension',
      dimension: 'region',
      values: ['华东']
    });
    expect(values.has('f-channel')).toBe(false);
    expect(values.get('f-time')).toEqual({
      type: 'timeRange',
      from: '2026-01-01',
      to: '2026-03-31'
    });
  });

  it('相对预设按打开时刻解析为绝对范围(last7d 含当天共 7 天)', () => {
    const now = new Date(2026, 6, 20); // 2026-07-20(本地时区)
    const values = initialFilterValues([{ id: 'f-time', type: 'timeRange', default: 'last7d' }], now);
    expect(values.get('f-time')).toEqual({
      type: 'timeRange',
      from: '2026-07-14',
      to: '2026-07-20'
    });
  });
});
