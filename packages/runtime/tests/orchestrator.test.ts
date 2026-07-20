import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, Row, Widget } from '@metriccanvas/page';
import { orchestrate, type PageSnapshots } from '../src/orchestrator';
import { createFilterState, type FilterValue } from '../src/filter-state';
import type { DataGateway } from '../src/ports';

/** mock 在系统边界(数据网关端口),非内部协作者 */
function immediateGateway(rows: Row[] | Error) {
  const received: EffectiveQuery[] = [];
  const gateway: DataGateway = {
    async fetchData(query) {
      received.push(query);
      if (rows instanceof Error) throw rows;
      return rows;
    },
    async fetchDimensionValues() {
      return [];
    }
  };
  return { received, gateway };
}

/** 可控网关:测试竞态与退订时,由测试代码决定每次查询何时以何结果返回 */
function deferredGateway() {
  const pending: Array<{ query: EffectiveQuery; resolve: (rows: Row[]) => void }> = [];
  const gateway: DataGateway = {
    fetchData(query) {
      return new Promise<Row[]>((resolve) => {
        pending.push({ query, resolve });
      });
    },
    async fetchDimensionValues() {
      return [];
    }
  };
  return { pending, gateway };
}

function metricCard(id: string, subscribe?: string[]): Widget {
  return {
    id,
    type: 'metricCard',
    position: { x: 0, y: 0, w: 3, h: 2 },
    query: { metrics: ['gmv'], ...(subscribe ? { filters: { subscribe } } : {}) }
  };
}

/** 收集快照流推送 */
function collect(stream: ReturnType<typeof orchestrate>) {
  const pushes: PageSnapshots[] = [];
  const unsubscribe = stream.subscribe((snapshots) => {
    pushes.push(snapshots);
  });
  return { pushes, unsubscribe, latest: () => pushes[pushes.length - 1] };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('查询编排器:冷流与快照时间线', () => {
  it('冷流:订阅者到达前不发任何查询', async () => {
    const { gateway, received } = immediateGateway([{ gmv: 1 }]);
    orchestrate([metricCard('w-a')], gateway);
    await flush();
    expect(received).toHaveLength(0);
  });

  it('首发同步且键集完整:subscribe 立即收到含全部 widget id 的 loading Map', () => {
    const { gateway } = immediateGateway([{ gmv: 1 }]);
    const { pushes } = collect(orchestrate([metricCard('w-a'), metricCard('w-b')], gateway));
    expect(pushes).toHaveLength(1);
    expect([...pushes[0].keys()].sort()).toEqual(['w-a', 'w-b']);
    expect(pushes[0].get('w-a')).toEqual({ status: 'loading' });
    expect(pushes[0].get('w-b')).toEqual({ status: 'loading' });
  });

  it('数据返回后快照转就绪,每次变更推送新 Map 实例', async () => {
    const { gateway } = immediateGateway([{ gmv: 1000 }]);
    const { pushes, latest } = collect(orchestrate([metricCard('w-a')], gateway));
    await flush();
    expect(latest().get('w-a')).toEqual({ status: 'ready', rows: [{ gmv: 1000 }] });
    expect(new Set(pushes).size).toBe(pushes.length);
  });

  it('空结果为空态;网关异常化为错误态快照,不抛出', async () => {
    const empty = immediateGateway([]);
    const { latest: latestEmpty } = collect(orchestrate([metricCard('w-a')], empty.gateway));
    const failing = immediateGateway(new Error('数据服务不可达'));
    const { latest: latestError } = collect(orchestrate([metricCard('w-a')], failing.gateway));
    await flush();
    expect(latestEmpty().get('w-a')).toEqual({ status: 'empty' });
    expect(latestError().get('w-a')).toEqual({
      status: 'error',
      error: { message: '数据服务不可达' }
    });
  });
});

describe('查询编排器:生效查询合成', () => {
  it('生效查询 = 结构化查询 × 订阅筛选器当前值(维度进 conditions,时间进 timeRange)', async () => {
    const { gateway, received } = immediateGateway([{ gmv: 1 }]);
    const filters = createFilterState(
      new Map<string, FilterValue>([
        ['f-region', { type: 'dimension' as const, dimension: 'region', values: ['华东', '华南'] }],
        ['f-time', { type: 'timeRange' as const, from: '2026-06-01', to: '2026-06-30' }]
      ])
    );
    collect(orchestrate([metricCard('w-a', ['f-time', 'f-region'])], gateway, filters));
    await flush();
    expect(received).toEqual([
      {
        metrics: ['gmv'],
        conditions: [{ dimension: 'region', operator: 'in', value: ['华东', '华南'] }],
        timeRange: { from: '2026-06-01', to: '2026-06-30' }
      }
    ]);
  });

  it('未订阅的筛选器值不进入生效查询', async () => {
    const { gateway, received } = immediateGateway([{ gmv: 1 }]);
    const filters = createFilterState(
      new Map<string, FilterValue>([['f-region', { type: 'dimension' as const, dimension: 'region', values: ['华东'] }]])
    );
    collect(orchestrate([metricCard('w-a', ['f-time'])], gateway, filters));
    await flush();
    expect(received).toEqual([{ metrics: ['gmv'], conditions: [] }]);
  });

  it('去重:相同生效查询的两个 widget 只触发一次网关请求,各自收到就绪快照', async () => {
    const { gateway, received } = immediateGateway([{ gmv: 7 }]);
    const { latest } = collect(
      orchestrate([metricCard('w-a', ['f-time']), metricCard('w-b', ['f-time'])], gateway)
    );
    await flush();
    expect(received).toHaveLength(1);
    expect(latest().get('w-a')).toEqual({ status: 'ready', rows: [{ gmv: 7 }] });
    expect(latest().get('w-b')).toEqual({ status: 'ready', rows: [{ gmv: 7 }] });
  });
});

describe('查询编排器:筛选变更与差量重查', () => {
  it('筛选变更只让订阅了该筛选器的 widget 重走时间线,其余快照引用不变', async () => {
    const { gateway, received } = immediateGateway([{ gmv: 1 }]);
    const filters = createFilterState();
    const widgets = [metricCard('w-sub', ['f-region']), metricCard('w-other')];
    const { latest } = collect(orchestrate(widgets, gateway, filters));
    await flush();
    const before = latest();
    const queriesBefore = received.length;

    filters.write('f-region', { type: 'dimension', dimension: 'region', values: ['华东'] });
    expect(latest().get('w-sub')).toEqual({ status: 'loading' });
    expect(latest().get('w-other')).toBe(before.get('w-other'));
    await flush();

    expect(received.slice(queriesBefore)).toEqual([
      {
        metrics: ['gmv'],
        conditions: [{ dimension: 'region', operator: 'in', value: ['华东'] }]
      }
    ]);
    expect(latest().get('w-other')).toBe(before.get('w-other'));
  });

  it('竞态丢弃:只有该 widget 最新生效查询的结果能落成快照,过期在途结果一律丢弃', async () => {
    const { gateway, pending } = deferredGateway();
    const filters = createFilterState();
    const { latest } = collect(orchestrate([metricCard('w-a', ['f-region'])], gateway, filters));

    filters.write('f-region', { type: 'dimension', dimension: 'region', values: ['华东'] });
    filters.write('f-region', { type: 'dimension', dimension: 'region', values: ['华南'] });
    expect(pending).toHaveLength(3); // 初始 + 两次筛选变更

    // 故意让最新查询先返回,过期查询后返回
    pending[2].resolve([{ gmv: 300 }]);
    await flush();
    expect(latest().get('w-a')).toEqual({ status: 'ready', rows: [{ gmv: 300 }] });

    pending[0].resolve([{ gmv: 100 }]);
    pending[1].resolve([{ gmv: 200 }]);
    await flush();
    expect(latest().get('w-a')).toEqual({ status: 'ready', rows: [{ gmv: 300 }] });
  });
});

describe('查询编排器:退订即取消', () => {
  it('最后一个订阅者退订后,在途查询结果作废,订阅者永不再被回调', async () => {
    const { gateway, pending } = deferredGateway();
    const { pushes, unsubscribe } = collect(orchestrate([metricCard('w-a')], gateway));
    const pushesBefore = pushes.length;

    unsubscribe();
    pending[0].resolve([{ gmv: 1 }]);
    await flush();
    expect(pushes).toHaveLength(pushesBefore);
  });

  it('退订后筛选变更不再触发查询(编排器已与筛选状态解绑)', async () => {
    const { gateway, pending } = deferredGateway();
    const filters = createFilterState();
    const { unsubscribe } = collect(orchestrate([metricCard('w-a', ['f-region'])], gateway, filters));
    expect(pending).toHaveLength(1);

    unsubscribe();
    filters.write('f-region', { type: 'dimension', dimension: 'region', values: ['华东'] });
    await flush();
    expect(pending).toHaveLength(1);
  });

  it('多订阅者共享同一次执行:第二个订阅者立即收到当前快照,不重复取数', async () => {
    const { gateway, received } = immediateGateway([{ gmv: 5 }]);
    const stream = orchestrate([metricCard('w-a')], gateway);
    const first = collect(stream);
    await flush();

    const second = collect(stream);
    expect(second.pushes).toHaveLength(1);
    expect(second.latest().get('w-a')).toEqual({ status: 'ready', rows: [{ gmv: 5 }] });
    expect(received).toHaveLength(1);

    // 先退订一个,另一个仍在:执行不终止
    first.unsubscribe();
    expect(second.latest().get('w-a')).toEqual({ status: 'ready', rows: [{ gmv: 5 }] });
  });
});
