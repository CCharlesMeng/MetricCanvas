import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { createSourceProgram } from '../../../packages/data-execution/src/runtime';
import fixture from '../../../pages/capabilities/table/table-column-candidates-query.json';
import { createFullQueryCandidatesPreview } from '../fixtures/full-query-candidates';

it('registers full-query reads through the application gateway, preserves metrics and excludes only the target header', async () => {
  const parsed = parsePage(fixture); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const preview = createFullQueryCandidatesPreview(), program = createSourceProgram(parsed.page, { gateway: preview.dataGateway });
  const view = { pageIndex: 8, pageSize: 20, sort: [], predicates: [{ field: 'office', op: 'in' as const, values: ['办事处80'] }] };
  try {
    const page = await program.readColumnCandidates({ sourceId: 'records', field: 'office', conditions: new Map(), view, candidateSearch: '办事处80' });
    expect(page).toEqual({ kind: 'values', totalCount: 1, candidates: [{ value: '办事处80', label: '办事处80' }] });
    expect(preview.requests.map(item => item.order)).toEqual([
      { order_by_field: '编号', type: 'asc', offset: 0, limit: 200 },
      { order_by_field: '编号', type: 'asc', offset: 200, limit: 200 },
      { order_by_field: '编号', type: 'asc', offset: 400, limit: 200 },
      { order_by_field: '编号', type: 'asc', offset: 600, limit: 200 }
    ]);
    for (const item of preview.requests) expect(item).toMatchObject({ output_dims: ['编号', '区域', '代表处'], output_metrics: ['收入'],
      filter: { time: { start: '2026-01', end: '2026-09' }, dims: [], metrics: [] } });
    const narrowed = await program.readColumnCandidates({ sourceId: 'records', field: 'office', conditions: new Map(), view: {
      ...view, predicates: [...view.predicates, { field: 'region', op: 'in', values: ['华南'] }]
    } });
    expect(narrowed).toMatchObject({ totalCount: 20 });
    expect(preview.requests.at(-1)).toMatchObject({ filter: { dims: [{ dim_name: '区域', dim_value_list: ['华南'] }] } });
  } finally { program.dispose(); }
});

it('rejects 1001 raw rows by default, but allows an explicit application runtime override', async () => {
  const parsed = parsePage(fixture); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  for (const state of ['over-limit', 'raised-limit']) {
    const preview = createFullQueryCandidatesPreview(state), program = createSourceProgram(parsed.page, { gateway: preview.dataGateway });
    try {
      const result = program.readColumnCandidates({ sourceId: 'records', field: 'office', conditions: new Map(),
        view: { pageIndex: 0, pageSize: 20, sort: [], predicates: [] } });
      if (state === 'over-limit') {
        await expect(result).rejects.toMatchObject({ code: 'DQE_CANDIDATE_LIMIT_EXCEEDED' });
        expect(preview.requests).toHaveLength(1);
        const narrowed = await program.readColumnCandidates({ sourceId: 'records', field: 'office', conditions: new Map(),
          view: { pageIndex: 0, pageSize: 20, sort: [], predicates: [{ field: 'region', op: 'in', values: ['华南'] }] } });
        expect(narrowed).toMatchObject({ totalCount: 20 });
      } else {
        expect(await result).toMatchObject({ totalCount: 80 });
        expect(preview.requests).toHaveLength(6);
      }
    } finally { program.dispose(); }
  }
});

it('does not present a truncated source response as complete candidates', async () => {
  const parsed = parsePage(fixture); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const preview = createFullQueryCandidatesPreview('truncated'), program = createSourceProgram(parsed.page, { gateway: preview.dataGateway });
  try {
    await expect(program.readColumnCandidates({ sourceId: 'records', field: 'office', conditions: new Map(),
      view: { pageIndex: 0, pageSize: 20, sort: [], predicates: [] } })).rejects.toMatchObject({ code: 'DQE_ROW_CONTRACT_ERROR' });
  } finally { program.dispose(); }
});
