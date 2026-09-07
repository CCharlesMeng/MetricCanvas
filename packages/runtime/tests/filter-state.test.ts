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

  it('writeMany 原子更新多个联动筛选器且只通知一次', () => {
    const state = createFilterState();
    const { pushes } = collect(state);

    state.writeMany([
      [
        'inspection-office',
        {
          type: 'dimension',
          dimension: 'representative-office',
          values: ['XX代表处02']
        }
      ],
      [
        'inspection-scope',
        {
          type: 'dimension',
          dimension: 'customer-scope',
          values: ['TOP100']
        }
      ]
    ]);

    expect(pushes).toHaveLength(2);
    expect(pushes[1].get('inspection-office')).toMatchObject({
      values: ['XX代表处02']
    });
    expect(pushes[1].get('inspection-scope')).toMatchObject({
      values: ['TOP100']
    });
  });

  it('write 丢弃非法公历时间范围,不清除已有合法值且不通知', () => {
    const state = createFilterState(
      new Map<string, FilterValue>([['f-time', june]])
    );
    const { pushes } = collect(state);

    for (const value of [
      { type: 'timeRange' as const, from: '2026-02-29', to: '2026-03-01' },
      { type: 'timeRange' as const, from: '2026-07-21', to: '2026-07-20' },
      { type: 'timeRange' as const, from: '2026-07-20', to: '2026-07-20T18:00' },
      { type: 'timeRange' as const, from: '2026-07-20T24:00', to: '2026-07-20T24:01' }
    ]) {
      expect(() => state.write('f-time', value)).not.toThrow();
    }

    expect(pushes).toHaveLength(1);
    expect(pushes[0].get('f-time')).toEqual(june);
  });

  it('退订后不再收到通知', () => {
    const state = createFilterState();
    const { pushes, unsubscribe } = collect(state);
    unsubscribe();
    state.write('f-region', region);
    expect(pushes).toHaveLength(1);
  });
});

describe('筛选状态 store:普通 URL', () => {
  const declarations: import('@metriccanvas/page').FilterDeclaration[] = [
    {id:'region',type:'dimension',dimension:'geo',hierarchy:[{id:'geo',dimension:'geo'},{id:'office',dimension:'office-code'}],urlParams:{value:'region',level:'level'}},
    {id:'period',type:'timeRange',urlParams:{from:'from',to:'to'}},
    {id:'flag',type:'boolean'}, {id:'amount',type:'numberRange'},
    {id:'month',type:'timePoint',granularity:'month'}, {id:'keyword',type:'search'}
  ];
  it('全部类型往返，保留多选、层级和特殊字符，不读取未声明参数', () => {
    const initial = new Map<string, FilterValue>([
      ['region',{type:'dimension',dimension:'office-code',level:'office',values:['华东,直营','A&/?+%']}],
      ['period',{type:'timeRange',from:'2026-04-01',to:'2026-04-30'}],
      ['flag',{type:'boolean',value:false}], ['amount',{type:'numberRange',from:0,to:9}],
      ['month',{type:'timePoint',granularity:'month',value:'2026-04'}], ['keyword',{type:'search',query:'云迁移'}]
    ]);
    const source = createFilterState(initial), restored = createFilterState();
    const search = source.toURL(declarations);
    expect(new URLSearchParams(search).getAll('region')).toEqual(['华东,直营','A&/?+%']);
    restored.fromURL(search+'&unused=secret',declarations);
    expect(collect(restored).pushes[0]).toEqual(initial);
  });
  it('接收方声明决定类型，非法范围和未知层级被忽略', () => {
    const state = createFilterState();
    state.fromURL('region=A&level=unknown&from=2026-02-29&to=2026-03-01&amount.from=bad&flag=yes&month=2026-99',declarations);
    expect(collect(state).pushes[0].size).toBe(0);
  });
  it('整体替换并通知，空状态不产生查询参数', () => {
    const state = createFilterState(new Map([['flag',{type:'boolean',value:true}]]));
    const {pushes} = collect(state);
    state.fromURL('keyword=hello',declarations);
    expect(pushes).toHaveLength(2);
    expect(pushes[1]).toEqual(new Map([['keyword',{type:'search',query:'hello'}]]));
    expect(createFilterState().toURL()).toBe('');
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

  it('结构化相对时间 default 按打开时刻求值', () => {
    const now = new Date(2026, 6, 20);
    const values = initialFilterValues(
      [
        {
          id: 'f-time',
          type: 'timeRange',
          default: { unit: 'month', range: { kind: 'previousComplete' }, includeCurrent: false }
        }
      ],
      now
    );
    expect(values.get('f-time')).toEqual({
      type: 'timeRange',
      from: '2026-06-01',
      to: '2026-06-30'
    });
  });

  it('datetime 精度的预设解析为 YYYY-MM-DDTHH:mm(datetime-local 可直接回显)', () => {
    const now = new Date(2026, 6, 20, 9, 5); // 2026-07-20 09:05(本地时区)
    const values = initialFilterValues(
      [{ id: 'f-time', type: 'timeRange', precision: 'datetime', default: 'today' }],
      now
    );
    expect(values.get('f-time')).toEqual({
      type: 'timeRange',
      from: '2026-07-20T00:00',
      to: '2026-07-20T09:05'
    });
  });
});

describe('筛选状态 store:订阅方异常隔离(write 永不 throw)', () => {
  it('某个订阅方回调抛异常,write 不抛出、状态照常更新、其余订阅方照常收到通知', () => {
    const state = createFilterState();
    state.subscribe(() => {
      throw new Error('坏订阅方');
    });
    const { pushes } = collect(state);
    expect(() => state.write('f-region', region)).not.toThrow();
    expect(pushes[pushes.length - 1].get('f-region')).toEqual(region);
  });
});
