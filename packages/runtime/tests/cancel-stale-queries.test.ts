import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, Page, Row } from '@metriccanvas/page';
import { createFilterState } from '../src/filter-state';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import type { DataGateway } from '../src/ports';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

interface GatewayCall {
  query: EffectiveQuery;
  signal: AbortSignal | undefined;
  resolve(result: { rows: Row[]; totalCount?: number }): void;
  reject(cause: unknown): void;
}

/** 可控挂起的假网关:每次执行登记一条调用,由测试决定何时以何种方式结算。 */
function controllableGateway(): { gateway: DataGateway; calls: GatewayCall[] } {
  const calls: GatewayCall[] = [];
  const gateway: DataGateway = {
    fetchData(query, _diagnosticContext, signal) {
      return new Promise((resolve, reject) => {
        calls.push({ query, signal, resolve, reject });
      });
    }
  };
  return { gateway, calls };
}

/** 让一条调用表现得像真实适配器:中止即按 DQE_CANCELLED 拒绝。 */
function honorAbort(call: GatewayCall): void {
  call.signal?.addEventListener('abort', () => {
    call.reject(
      Object.assign(new Error('DQE 请求已被取消'), { code: 'DQE_CANCELLED' })
    );
  });
}

function dimension(name: string, values: string[]) {
  return { type: 'dimension', dimension: name, values } as const;
}

function singleSourcePage(): Page {
  return {
    schemaVersion: '5.0',
    id: 'cancel-single',
    filters: [{ id: 'fa', type: 'dimension', dimension: 'product', label: '产品' }],
    dataSources: {
      alpha: {
        fields: {
          amount: { queryField: '金额', type: 'number', role: 'measure' }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [{
                output_dims: [],
                output_metrics: ['金额'],
                filter: { dims: [], metrics: [] },
                order: {}
              }]
            },
            filterBindings: {
              fa: { target: 'dimension', queryField: '产品' }
            }
          }
        }
      }
    },
    sections: [{
      id: 'main',
      components: [{
        id: 'card',
        type: 'metricCard',
        layout: { span: 4 },
        data: { main: 'alpha' },
        props: { rows: [{ label: '金额', valueField: 'amount' }] }
      }]
    }]
  };
}

function twoSourcePage(): Page {
  const document = singleSourcePage();
  return {
    ...document,
    id: 'cancel-two-sources',
    filters: [
      ...(document.filters ?? []),
      { id: 'fb', type: 'dimension', dimension: 'region', label: '地区' }
    ],
    dataSources: {
      ...document.dataSources,
      beta: {
        fields: {
          count: { queryField: '数量', type: 'number', role: 'measure' }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [{
                output_dims: [],
                output_metrics: ['数量'],
                filter: { dims: [], metrics: [] },
                order: {}
              }]
            },
            filterBindings: {
              fb: { target: 'dimension', queryField: '地区' }
            }
          }
        }
      }
    },
    sections: [{
      id: 'main',
      components: [
        ...document.sections[0]!.components,
        {
          id: 'card-beta',
          type: 'metricCard',
          layout: { span: 4 },
          data: { main: 'beta' },
          props: { rows: [{ label: '数量', valueField: 'count' }] }
        }
      ]
    }]
  };
}

/** 两个数据源共享同一查询定义与分页声明:生效查询去重后共享一次执行。 */
function dedupPaginationPage(): Page {
  const querySource = {
    fields: {
      region: { queryField: '地区', type: 'string', role: 'dimension' },
      revenue: { queryField: '收入', type: 'number', role: 'measure' }
    },
    source: {
      type: 'query',
      query: {
        language: 'dqe',
        body: {
          dsl_list: [{
            output_dims: ['地区'],
            output_metrics: ['收入'],
            filter: { dims: [], metrics: [] },
            order: { offset: 0, limit: 10 }
          }]
        }
      }
    }
  } as const;
  const table = (id: string, source: string) => ({
    id,
    type: 'table' as const,
    layout: { span: 6 },
    data: { main: source },
    props: {
      columns: [{ field: 'region', title: '地区' }],
      pagination: { mode: 'query' as const }
    }
  });
  return {
    schemaVersion: '5.0',
    id: 'cancel-dedup',
    dataSources: {
      list: JSON.parse(JSON.stringify(querySource)) as Page['dataSources'][string],
      'list-copy': JSON.parse(JSON.stringify(querySource)) as Page['dataSources'][string]
    },
    sections: [{
      id: 'main',
      components: [table('table-list', 'list'), table('table-copy', 'list-copy')]
    }]
  };
}

describe('筛选状态变化时取消过期生效查询(issue #53)', () => {
  it('同一查询定义连续快速筛选:每个过期请求被真中止,取消不进入错误态,只落最终结果', async () => {
    const { gateway, calls } = controllableGateway();
    const filters = createFilterState();
    const pushes: PageDataSnapshots[] = [];
    const unsubscribe = orchestrate(singleSourcePage(), gateway, filters).subscribe(
      (value) => pushes.push(value)
    );

    expect(calls).toHaveLength(1);
    honorAbort(calls[0]!);

    filters.write('fa', dimension('product', ['手机']));
    expect(calls).toHaveLength(2);
    expect(calls[0]!.signal?.aborted).toBe(true);
    expect(calls[1]!.signal?.aborted).toBe(false);
    honorAbort(calls[1]!);

    filters.write('fa', dimension('product', ['平板']));
    expect(calls).toHaveLength(3);
    expect(calls[1]!.signal?.aborted).toBe(true);
    expect(calls[2]!.signal?.aborted).toBe(false);

    calls[2]!.resolve({ rows: [{ amount: 3 }], totalCount: 1 });
    await flush();

    expect(pushes.at(-1)?.get('alpha')).toEqual({
      status: 'ready',
      rows: [{ amount: 3 }],
      totalCount: 1
    });
    // 已取消请求按 DQE_CANCELLED 拒绝,但不得成为用户可见错误:全程无 error 快照。
    expect(
      pushes.every((snapshot) => snapshot.get('alpha')?.status !== 'error')
    ).toBe(true);
    unsubscribe();
  });

  it('取消失败(旧请求无视中止后完成):迟到结果不覆盖新结果', async () => {
    const { gateway, calls } = controllableGateway();
    const filters = createFilterState();
    const pushes: PageDataSnapshots[] = [];
    const unsubscribe = orchestrate(singleSourcePage(), gateway, filters).subscribe(
      (value) => pushes.push(value)
    );

    filters.write('fa', dimension('product', ['手机']));
    expect(calls[0]!.signal?.aborted).toBe(true);

    calls[1]!.resolve({ rows: [{ amount: 9 }], totalCount: 1 });
    await flush();
    expect(pushes.at(-1)?.get('alpha')).toEqual({
      status: 'ready',
      rows: [{ amount: 9 }],
      totalCount: 1
    });

    // 旧请求不响应中止,迟到完成:结果被丢弃,新结果保持不变。
    calls[0]!.resolve({ rows: [{ amount: 1 }], totalCount: 1 });
    await flush();
    expect(pushes.at(-1)?.get('alpha')).toEqual({
      status: 'ready',
      rows: [{ amount: 9 }],
      totalCount: 1
    });
    expect(
      pushes.every((snapshot) => {
        const alpha = snapshot.get('alpha');
        return alpha?.status !== 'ready' || alpha.rows[0]?.amount !== 1;
      })
    ).toBe(true);
    unsubscribe();
  });

  it('旧请求先完成:结果正常落快照,随后筛选变化重新执行且不受影响', async () => {
    const { gateway, calls } = controllableGateway();
    const filters = createFilterState();
    const pushes: PageDataSnapshots[] = [];
    const unsubscribe = orchestrate(singleSourcePage(), gateway, filters).subscribe(
      (value) => pushes.push(value)
    );

    calls[0]!.resolve({ rows: [{ amount: 1 }], totalCount: 1 });
    await flush();
    expect(pushes.at(-1)?.get('alpha')).toEqual({
      status: 'ready',
      rows: [{ amount: 1 }],
      totalCount: 1
    });

    filters.write('fa', dimension('product', ['手机']));
    expect(pushes.at(-1)?.get('alpha')).toEqual({ status: 'loading' });
    // 已完成的请求不存在可中止对象,新请求正常执行。
    expect(calls).toHaveLength(2);
    calls[1]!.resolve({ rows: [{ amount: 2 }], totalCount: 1 });
    await flush();
    expect(pushes.at(-1)?.get('alpha')).toEqual({
      status: 'ready',
      rows: [{ amount: 2 }],
      totalCount: 1
    });
    unsubscribe();
  });

  it('不同查询定义之间不误取消:只中止被筛选触及的数据源', async () => {
    const { gateway, calls } = controllableGateway();
    const filters = createFilterState();
    const pushes: PageDataSnapshots[] = [];
    const unsubscribe = orchestrate(twoSourcePage(), gateway, filters).subscribe(
      (value) => pushes.push(value)
    );

    expect(calls).toHaveLength(2);
    const [alphaCall, betaCall] = calls;
    filters.write('fa', dimension('product', ['手机']));

    expect(alphaCall!.signal?.aborted).toBe(true);
    expect(betaCall!.signal?.aborted).toBe(false);

    betaCall!.resolve({ rows: [{ count: 7 }], totalCount: 1 });
    await flush();
    expect(pushes.at(-1)?.get('beta')).toEqual({
      status: 'ready',
      rows: [{ count: 7 }],
      totalCount: 1
    });
    unsubscribe();
  });

  it('去重共享执行:仍有成员在当前代次时不中止,迟到结果只落给未过期成员', async () => {
    const { gateway, calls } = controllableGateway();
    const pushes: PageDataSnapshots[] = [];
    const stream = orchestrate(dedupPaginationPage(), gateway);
    const unsubscribe = stream.subscribe((value) => pushes.push(value));

    // 两个数据源的生效查询相同,去重后共享一次执行。
    expect(calls).toHaveLength(1);

    stream.setQueryPage('list', 1);
    // list 的代次推进,但共享执行仍服务 list-copy,不得中止。
    expect(calls[0]!.signal?.aborted).toBe(false);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.query.pagination).toEqual({ offset: 10, limit: 10 });

    calls[0]!.resolve({
      rows: [{ region: '第1页', revenue: 1 }],
      totalCount: 25
    });
    await flush();
    // 共享执行的结果只落给仍在当前代次的 list-copy;list 等待新请求。
    expect(pushes.at(-1)?.get('list-copy')).toEqual({
      status: 'ready',
      rows: [{ region: '第1页', revenue: 1 }],
      totalCount: 25
    });
    expect(pushes.at(-1)?.get('list')).toEqual({ status: 'loading' });

    calls[1]!.resolve({
      rows: [{ region: '第2页', revenue: 2 }],
      totalCount: 25
    });
    await flush();
    expect(pushes.at(-1)?.get('list')).toEqual({
      status: 'ready',
      rows: [{ region: '第2页', revenue: 2 }],
      totalCount: 25
    });
    unsubscribe();
  });

  it('运行时会话结束(页面卸载或页面修订切换):中止仍在运行的查询', () => {
    const { gateway, calls } = controllableGateway();
    const unsubscribe = orchestrate(twoSourcePage(), gateway).subscribe(() => {});

    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.signal?.aborted === false)).toBe(true);

    // 最后一个订阅方退订即会话结束(RuntimeView 在页面修订切换时同样走这里)。
    unsubscribe();
    expect(calls.every((call) => call.signal?.aborted === true)).toBe(true);
  });

  it('取消失败的迟到越界分页结果不触发纠偏回查,不推进过期成员的代次', async () => {
    const { gateway, calls } = controllableGateway();
    const pushes: PageDataSnapshots[] = [];
    const stream = orchestrate(dedupPaginationPage(), gateway);
    const unsubscribe = stream.subscribe((value) => pushes.push(value));

    stream.setQueryPage('list', 5);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.query.pagination).toEqual({ offset: 50, limit: 10 });

    stream.setQueryPage('list', 2);
    // 第 6 页请求已是唯一成员且过期,被中止;第 3 页请求在途。
    expect(calls[1]!.signal?.aborted).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.query.pagination).toEqual({ offset: 20, limit: 10 });

    // 第 6 页请求无视中止迟到完成,offset 50 越界(总条数 25):过期结果
    // 不得触发纠偏回查,否则会推进代次、误取消在途的第 3 页请求。
    calls[1]!.resolve({ rows: [], totalCount: 25 });
    await flush();
    expect(calls).toHaveLength(3);
    expect(calls[2]!.signal?.aborted).toBe(false);

    calls[2]!.resolve({ rows: [{ region: '第3页', revenue: 3 }], totalCount: 25 });
    await flush();
    expect(pushes.at(-1)?.get('list')).toEqual({
      status: 'ready',
      rows: [{ region: '第3页', revenue: 3 }],
      totalCount: 25
    });
    unsubscribe();
  });
});
