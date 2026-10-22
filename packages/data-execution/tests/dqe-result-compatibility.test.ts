import { describe, expect, it } from 'vitest';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { parsePage } from '@metriccanvas/page';
import fixture from '../../../pages/capabilities/query/query-numeric-tolerance.json';
import { executeDqeItem } from '../../../tools/dqe-sim/src/execute';
import { createDqeGateway, createInMemoryDqeDiagnostics } from '../src/dqe';
import { createSourceProgram, initialFilterValues } from '../src/runtime';

const query: EffectiveQuery = {
  language: 'dqe',
  body: { dsl_list: [{ output_dims: ['区域'], output_metrics: ['数量'] }] },
  fieldMappings: {
    region: { queryField: '区域', type: 'string', role: 'dimension' },
    count: { queryField: '数量', type: 'number', role: 'measure' }
  },
  filterValues: []
};

function gateway(code: string, data: unknown, total_count: unknown = 1, status = 200) {
  const diagnostics = createInMemoryDqeDiagnostics();
  return {
    diagnostics,
    gateway: createDqeGateway({
      diagnostics,
      fetchImpl: async () => new Response(JSON.stringify({
        retCode: 'CBC.0000', results: [{ code, data, total_count }]
      }), { status })
    })
  };
}

describe('DQE 有数据的非成功返回码兼容', () => {
  it.each(['SUCCESS', 'success', 'NO_PERMISSION', 'ERROR', 'UNKNOWN_CODE'])(
    '%s 的数据继续归一化，并记录查询成功', async code => {
      const transport = gateway(code, [{ 区域: '华东', 数量: 0 }], 10);
      await expect(transport.gateway.fetchData(query)).resolves.toEqual({
        rows: [{ region: '华东', count: 0 }], totalCount: 10
      });
      expect(transport.diagnostics.records()).toMatchObject([
        { status: 'success', rowCount: 1, totalCount: 10 }
      ]);
    }
  );

  it.each(['NO_PERMISSION', 'ERROR', 'UNKNOWN_CODE'])(
    '%s 的维度候选值仍可使用', async code => {
      const transport = gateway(code, [{ 区域: '华东' }, { 区域: '华东' }], 2);
      await expect(transport.gateway.fetchDimensionValues('区域')).resolves.toEqual({
        kind: 'values', candidates: [{ value: '华东', label: '华东' }]
      });
    }
  );

  it.each([[], null, undefined, {}, 'data'])(
    '非成功返回码没有数据行时保留失败行为 (%j)', async data => {
      const transport = gateway('NO_PERMISSION', data, 0);
      await expect(transport.gateway.fetchData(query)).rejects.toMatchObject({ code: 'DQE_QUERY_REJECTED' });
      await expect(transport.gateway.fetchDimensionValues('区域')).resolves.toEqual({ kind: 'unavailable' });
    }
  );

  it('SUCCESS 的空数组仍为成功空结果', async () => {
    const transport = gateway('SUCCESS', [], 0);
    await expect(transport.gateway.fetchData(query)).resolves.toEqual({ rows: [], totalCount: 0 });
  });

  it('完整页面动态取数后进入可渲染状态', async () => {
    const parsed = parsePage(fixture);
    if (!parsed.ok) throw new Error('验收页面无法解析');
    const transport = createDqeGateway({ fetchImpl: async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      return new Response(JSON.stringify({ retCode: 'CBC.0000', results: body.dsl_list.map(
        (item: Parameters<typeof executeDqeItem>[0]) => ({ ...executeDqeItem(item), code: 'NO_PERMISSION' })
      ) }));
    } });
    const program = createSourceProgram(parsed.page, { gateway: transport });
    const snapshots = [];
    try {
      for await (const update of program.read({
        roots: ['samples'], conditions: initialFilterValues(parsed.page.filters ?? []), useInitial: false
      })) snapshots.push(update.snapshot);
    } finally { program.dispose(); }
    expect(snapshots.at(-1)).toMatchObject({
      status: 'ready', totalCount: 8,
      rows: expect.arrayContaining([expect.objectContaining({ sample: '正常', value: 10 })])
    });
  });

  it('兼容数据仍须通过行结构和总条数校验', async () => {
    await expect(gateway('NO_PERMISSION', [null]).gateway.fetchData(query)).rejects.toMatchObject({ code: 'DQE_ROW_CONTRACT_ERROR' });
    await expect(gateway('NO_PERMISSION', [{ 区域: '华东', 数量: 1 }], -1).gateway.fetchData(query)).rejects.toMatchObject({ code: 'DQE_ITEM_ERROR' });
  });

  it.each([401, 403])('HTTP %s 即使带数据仍拒绝', async status => {
    await expect(gateway('NO_PERMISSION', [{ 区域: '华东', 数量: 1 }], 1, status).gateway.fetchData(query))
      .rejects.toMatchObject({ code: status === 401 ? 'DQE_AUTH_REQUIRED' : 'DQE_FORBIDDEN' });
  });
});
