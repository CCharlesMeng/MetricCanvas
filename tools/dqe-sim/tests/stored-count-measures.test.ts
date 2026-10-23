import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../../../packages/page/src';
import { createDqeGateway } from '../../../packages/data-execution/src/dqe';
import { createSourceProgram, initialFilterValues } from '../../../packages/data-execution/src/runtime';
import type { DataSnapshot } from '../../../packages/page/src/internal';
import { barOption } from '../../../packages/engine/widgets/src/components/bar-chart/options';
import { createDqeSimServer, DQE_EXECUTE_PATH } from '../src/server';

it('实际页面通过 HTTP 返回现成计数，筛选和完整读取不改写查询或聚合', async () => {
  const document = JSON.parse(readFileSync('pages/capabilities/query/stored-count-measures.json', 'utf8'));
  const parsed = parsePage(document);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const server = createDqeSimServer({ logger: false });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server address');
  const requests: any[] = [];
  const gateway = createDqeGateway({
    endpoint: `http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`,
    fetchImpl: async (url, options) => {
      requests.push(JSON.parse(String(options?.body)));
      return fetch(url, options);
    }
  });
  const program = createSourceProgram(parsed.page, { gateway });
  const conditions = initialFilterValues(parsed.page.filters ?? []);
  async function read(purpose: 'screen' | 'complete', freshness: 'reuse' | 'refresh' = 'reuse') {
    let snapshot: DataSnapshot | undefined;
    for await (const update of program.read({ roots: ['counts'], conditions, purpose, freshness,
      useInitial: purpose === 'screen' && freshness === 'reuse' })) {
      snapshot = update.snapshot;
    }
    return snapshot;
  }
  try {
    // 首屏 initial 与动态 HTTP 结果走同一份字段契约。
    const initial = await read('screen');
    if (initial?.status !== 'ready') throw new Error('initial snapshot');
    expect(initial.rows).toHaveLength(4);
    expect(requests).toHaveLength(0);
    const beforeRefresh = requests.length;
    const result = await read('screen', 'refresh');
    expect(requests.length).toBeGreaterThan(beforeRefresh);
    expect(result).toMatchObject({ status: 'ready', rows: initial?.rows });
    const chart = parsed.page.sections[0].components[0];
    if (chart.type !== 'barChart' || result?.status !== 'ready') throw new Error('chart snapshot');
    const option = barOption({ main: { fields: parsed.page.dataSources.counts.fields, snapshot: result } }, chart.props);
    expect(option.series).toMatchObject([
      { type: 'bar', data: [{ value: 12 }, { value: 7 }, { value: 0 }, null] },
      { type: 'bar', data: [{ value: 9 }, { value: 5 }, { value: 0 }, { value: 3 }] }
    ]);
    conditions.set('region', { type: 'dimension', dimension: 'stored-region', values: ['南区'] });
    expect(await read('screen')).toMatchObject({ status: 'ready', rows: [{ region: '南区', regionId: 102, projects: 7, completed: 5 }] });
    expect(await read('complete')).toMatchObject({ rows: [{ projects: 7, completed: 5 }] });
    expect(requests.length).toBeGreaterThanOrEqual(2);
    for (const request of requests) {
      for (const item of request.dsl_list) {
        expect(item.output_dims).toEqual(document.dataSources.counts.source.query.body.dsl_list[0].output_dims);
        expect(item.output_metrics).toEqual([]);
      }
    }
    expect(requests.at(-1).dsl_list[0].filter.dims).toEqual([{ dim_name: '存量区域', dim_value_list: ['南区'] }]);
  } finally {
    program.dispose();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
