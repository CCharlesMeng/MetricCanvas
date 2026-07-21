import { describe, expect, it } from 'vitest';
import type {
  Component,
  DataSource,
  EffectiveQuery,
  FilterDeclaration,
  Page,
  Row,
  StructuredQuery
} from '@metriccanvas/page';
import {
  orchestrate,
  type PageSnapshots
} from '../src/orchestrator';
import { createFilterState, type FilterValue } from '../src/filter-state';
import type { DataGateway } from '../src/ports';

function querySource(query: StructuredQuery): DataSource {
  return {
    fields: {
      region: { type: 'string', role: 'dimension' },
      gmv: { type: 'number', role: 'metric' },
      change: { type: 'number', role: 'metric' }
    },
    source: { type: 'query', query }
  };
}

function inlineSource(rows: Row[]): DataSource {
  return {
    fields: {
      region: { type: 'string', role: 'dimension' },
      gmv: { type: 'number', role: 'metric' },
      target: { type: 'number', role: 'metric' }
    },
    source: { type: 'inline', rows }
  };
}

function metric(
  id: string,
  main = 'sales',
  extraData: Record<string, string> = {}
): Component {
  return {
    id,
    type: 'metricCard',
    layout: { span: 4 },
    data: { main, ...extraData },
    props: {
      rows: [
        {
          label: 'GMV',
          valueField: 'gmv',
          ...(extraData.compare
            ? { changes: [{ label: '变化', field: { data: 'compare', field: 'change' } }] }
            : {})
        }
      ]
    }
  };
}

function table(id: string, pageSize = 2, sourceId = 'sales'): Component {
  return {
    id,
    type: 'table',
    layout: { span: 12 },
    data: { main: sourceId },
    props: {
      columns: [{ field: 'region' }, { field: 'gmv' }],
      pagination: { mode: 'paged', pageSize }
    }
  };
}

function makePage(
  dataSources: Record<string, DataSource>,
  components: Component[],
  filters?: FilterDeclaration[]
): Page {
  return {
    schemaVersion: '1.0',
    id: 'runtime-test',
    dataSources,
    ...(filters ? { filters } : {}),
    sections: [
      {
        id: 'main',
        layout: { type: 'grid', columns: 12 },
        components
      }
    ]
  };
}

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

function collect(stream: ReturnType<typeof orchestrate>) {
  const pushes: PageSnapshots[] = [];
  const unsubscribe = stream.subscribe((snapshots) => pushes.push(snapshots));
  return {
    pushes,
    unsubscribe,
    latest: () => pushes[pushes.length - 1],
    slot: (componentId: string, name = 'main') =>
      pushes[pushes.length - 1].get(componentId)?.get(name)
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('统一 Page 数据源编排', () => {
  it('inline 首次订阅同步生成终态快照，空行生成 empty，且不访问网关', () => {
    const { gateway, received } = immediateGateway(new Error('不应调用'));
    const page = makePage(
      {
        filled: inlineSource([{ gmv: 100 }]),
        empty: inlineSource([])
      },
      [metric('filled-card', 'filled'), metric('empty-card', 'empty')]
    );

    const stream = orchestrate(page, gateway);
    expect(received).toHaveLength(0);
    const result = collect(stream);

    expect(result.pushes).toHaveLength(1);
    expect(result.slot('filled-card')).toEqual({ status: 'ready', rows: [{ gmv: 100 }] });
    expect(result.slot('empty-card')).toEqual({ status: 'empty' });
    expect(received).toHaveLength(0);
  });

  it('mixed 组件按命名数据槽同时交付 inline 终态和 query 时间线', async () => {
    const { gateway } = immediateGateway([{ change: 12 }]);
    const page = makePage(
      {
        fixed: inlineSource([{ gmv: 100 }]),
        live: querySource({ metrics: ['change'] })
      },
      [metric('comparison', 'fixed', { compare: 'live' })]
    );

    const result = collect(orchestrate(page, gateway));
    expect(result.slot('comparison', 'main')).toEqual({
      status: 'ready',
      rows: [{ gmv: 100 }]
    });
    expect(result.slot('comparison', 'compare')).toEqual({ status: 'loading' });

    await flush();
    expect(result.slot('comparison', 'main')).toEqual({
      status: 'ready',
      rows: [{ gmv: 100 }]
    });
    expect(result.slot('comparison', 'compare')).toEqual({
      status: 'ready',
      rows: [{ change: 12 }]
    });
  });

  it('query 保留 loading、ready、empty 和 error 四态', async () => {
    const ready = immediateGateway([{ gmv: 1 }]);
    const empty = immediateGateway([]);
    const failed = immediateGateway(new Error('数据服务不可达'));
    const page = makePage({ sales: querySource({ metrics: ['gmv'] }) }, [metric('card')]);

    const readyResult = collect(orchestrate(page, ready.gateway));
    const emptyResult = collect(orchestrate(page, empty.gateway));
    const failedResult = collect(orchestrate(page, failed.gateway));
    expect(readyResult.slot('card')).toEqual({ status: 'loading' });

    await flush();
    expect(readyResult.slot('card')).toEqual({ status: 'ready', rows: [{ gmv: 1 }] });
    expect(emptyResult.slot('card')).toEqual({ status: 'empty' });
    expect(failedResult.slot('card')).toEqual({
      status: 'error',
      error: { message: '数据服务不可达' }
    });
  });

  it('相同生效查询跨组件、跨数据槽同轮只访问一次网关', async () => {
    const { gateway, received } = immediateGateway([{ gmv: 7 }]);
    const page = makePage(
      { sales: querySource({ metrics: ['gmv'] }) },
      [
        metric('first'),
        metric('second'),
        metric('two-slots', 'sales', { compare: 'sales' })
      ]
    );
    const result = collect(orchestrate(page, gateway));

    await flush();
    expect(received).toHaveLength(1);
    expect(result.slot('first')).toEqual({ status: 'ready', rows: [{ gmv: 7 }] });
    expect(result.slot('two-slots', 'compare')).toEqual({
      status: 'ready',
      rows: [{ gmv: 7 }]
    });
  });
});

describe('query 筛选、缓存与竞态语义', () => {
  const filterDeclaration: FilterDeclaration = {
    id: 'region-filter',
    type: 'dimension',
    dimension: 'region'
  };
  const selected: FilterValue = {
    type: 'dimension',
    dimension: 'region',
    values: ['华东']
  };

  it('筛选变化只重查订阅该筛选器的数据槽，未受影响快照引用不变', async () => {
    const { gateway, received } = immediateGateway([{ gmv: 1 }]);
    const filters = createFilterState();
    const page = makePage(
      {
        subscribed: querySource({
          metrics: ['gmv'],
          filters: { subscribe: ['region-filter'] }
        }),
        independent: querySource({ metrics: ['gmv'], limit: 1 })
      },
      [metric('subscribed-card', 'subscribed'), metric('other-card', 'independent')],
      [filterDeclaration]
    );
    const result = collect(orchestrate(page, gateway, filters));
    await flush();
    const beforeOther = result.slot('other-card');

    filters.write('region-filter', selected);
    expect(result.slot('subscribed-card')).toEqual({ status: 'loading' });
    expect(result.slot('other-card')).toBe(beforeOther);
    await flush();

    expect(received.at(-1)).toEqual({
      metrics: ['gmv'],
      conditions: [{ dimension: 'region', operator: 'in', value: ['华东'] }]
    });
    expect(result.slot('other-card')).toBe(beforeOther);
  });

  it('筛选来回切换命中会话缓存，错误结果不进入缓存', async () => {
    let calls = 0;
    const gateway: DataGateway = {
      async fetchData() {
        calls++;
        if (calls === 1) throw new Error('暂时失败');
        return [{ gmv: calls }];
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const filters = createFilterState();
    const page = makePage(
      {
        sales: querySource({
          metrics: ['gmv'],
          filters: { subscribe: ['region-filter'] }
        })
      },
      [metric('card')],
      [filterDeclaration]
    );
    const result = collect(orchestrate(page, gateway, filters));
    await flush();
    expect(result.slot('card')?.status).toBe('error');

    filters.write('region-filter', selected);
    await flush();
    filters.write('region-filter', null);
    await flush();
    expect(calls).toBe(3);
    expect(result.slot('card')).toEqual({ status: 'ready', rows: [{ gmv: 3 }] });

    filters.write('region-filter', selected);
    await flush();
    expect(calls).toBe(3);
    expect(result.slot('card')).toEqual({ status: 'ready', rows: [{ gmv: 2 }] });
  });

  it('只允许组件数据槽的最新查询结果落地', async () => {
    const { gateway, pending } = deferredGateway();
    const filters = createFilterState();
    const page = makePage(
      {
        sales: querySource({
          metrics: ['gmv'],
          filters: { subscribe: ['region-filter'] }
        })
      },
      [metric('card')],
      [filterDeclaration]
    );
    const result = collect(orchestrate(page, gateway, filters));

    filters.write('region-filter', selected);
    filters.write('region-filter', {
      type: 'dimension',
      dimension: 'region',
      values: ['华南']
    });
    expect(pending).toHaveLength(3);

    pending[2].resolve([{ gmv: 300 }]);
    await flush();
    pending[0].resolve([{ gmv: 100 }]);
    pending[1].resolve([{ gmv: 200 }]);
    await flush();
    expect(result.slot('card')).toEqual({ status: 'ready', rows: [{ gmv: 300 }] });
  });
});

describe('query 并发与取消语义', () => {
  it('并发请求最多 5 个，完成后继续启动排队查询', async () => {
    const { gateway, pending } = deferredGateway();
    const dataSources = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        `source-${index}`,
        querySource({ metrics: [`metric-${index}`] })
      ])
    );
    const components = Array.from({ length: 7 }, (_, index) =>
      metric(`card-${index}`, `source-${index}`)
    );
    const result = collect(orchestrate(makePage(dataSources, components), gateway));

    expect(pending).toHaveLength(5);
    pending[0].resolve([{ value: 1 }]);
    await flush();
    expect(pending).toHaveLength(6);

    for (const request of pending.slice(1)) request.resolve([{ value: 1 }]);
    await flush();
    await flush();
    expect(pending).toHaveLength(7);
    pending[6].resolve([{ value: 1 }]);
    await flush();
    expect(
      [...result.latest().values()].every(
        (slots) => slots.get('main')?.status === 'ready'
      )
    ).toBe(true);
  });

  it('最后一个订阅者退订后丢弃在途结果并取消排队请求', async () => {
    const { gateway, pending } = deferredGateway();
    const dataSources = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        `source-${index}`,
        querySource({ metrics: [`metric-${index}`] })
      ])
    );
    const components = Array.from({ length: 7 }, (_, index) =>
      metric(`card-${index}`, `source-${index}`)
    );
    const result = collect(orchestrate(makePage(dataSources, components), gateway));
    const pushesBefore = result.pushes.length;
    expect(pending).toHaveLength(5);

    result.unsubscribe();
    pending[0].resolve([{ value: 1 }]);
    await flush();
    expect(pending).toHaveLength(5);
    expect(result.pushes).toHaveLength(pushesBefore);
  });
});

describe('表格组件局部视图', () => {
  it('分页默认视图盲翻多取一行，并裁剪展示数据', async () => {
    const { gateway, received } = immediateGateway([
      { region: '华东', gmv: 3 },
      { region: '华北', gmv: 2 },
      { region: '华南', gmv: 1 }
    ]);
    const page = makePage(
      { sales: querySource({ metrics: ['gmv'], dimensions: ['region'] }) },
      [table('sales-table')]
    );
    const result = collect(orchestrate(page, gateway));
    await flush();

    expect(received).toEqual([
      {
        metrics: ['gmv'],
        dimensions: ['region'],
        conditions: [],
        limit: 3,
        offset: 0
      }
    ]);
    expect(result.slot('sales-table')).toEqual({
      status: 'ready',
      rows: [
        { region: '华东', gmv: 3 },
        { region: '华北', gmv: 2 }
      ],
      hasMore: true
    });
  });

  it('同一数据源的两个组件各自持有视图，更新一个不会污染另一个', async () => {
    const { gateway, received } = immediateGateway([
      { region: '华东', gmv: 3 },
      { region: '华北', gmv: 2 },
      { region: '华南', gmv: 1 }
    ]);
    const page = makePage(
      { sales: querySource({ metrics: ['gmv'], dimensions: ['region'] }) },
      [table('left-table'), table('right-table')]
    );
    const stream = orchestrate(page, gateway);
    const result = collect(stream);
    await flush();
    expect(received).toHaveLength(1);
    const rightBefore = result.slot('right-table');

    stream.setView('left-table', {
      limit: 2,
      offset: 4,
      orderBy: [{ field: 'gmv', direction: 'desc' }],
      conditions: [{ dimension: 'region', operator: 'in', value: ['华东'] }]
    });
    expect(result.slot('left-table')).toEqual({ status: 'loading' });
    expect(result.slot('right-table')).toBe(rightBefore);
    await flush();

    expect(received.at(-1)).toEqual({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [{ dimension: 'region', operator: 'in', value: ['华东'] }],
      limit: 3,
      offset: 4,
      orderBy: [{ field: 'gmv', direction: 'desc' }]
    });
    expect(result.slot('right-table')).toBe(rightBefore);
  });

  it('局部视图缓存按组件生效查询区分，翻回旧页不重复请求', async () => {
    const { gateway, received } = immediateGateway([
      { region: '华东', gmv: 3 },
      { region: '华北', gmv: 2 },
      { region: '华南', gmv: 1 }
    ]);
    const page = makePage(
      { sales: querySource({ metrics: ['gmv'], dimensions: ['region'] }) },
      [table('sales-table')]
    );
    const stream = orchestrate(page, gateway);
    const result = collect(stream);
    await flush();
    const firstPage = result.slot('sales-table');

    stream.setView('sales-table', { limit: 2, offset: 2 });
    await flush();
    stream.setView('sales-table', { limit: 2, offset: 0 });
    await flush();

    expect(received).toHaveLength(2);
    expect(result.slot('sales-table')).toEqual(firstPage);
  });

  it('inline 数据组件和未知组件的 setView 均为 no-op', () => {
    const { gateway } = immediateGateway(new Error('不应调用'));
    const page = makePage(
      { fixed: inlineSource([{ gmv: 1 }]) },
      [metric('fixed-card', 'fixed')]
    );
    const stream = orchestrate(page, gateway);
    const result = collect(stream);

    expect(() => stream.setView('fixed-card', { limit: 1 })).not.toThrow();
    expect(() => stream.setView('missing', { limit: 1 })).not.toThrow();
    expect(result.pushes).toHaveLength(1);
  });
});
