import { describe, expect, it, vi } from 'vitest';
import { dqeDefaultSort, stableRowQuery, type EffectiveQuery } from '@metriccanvas/page/internal';
import { createDqeGateway, effectiveDqeItem } from '../src/dqe/dqe';
import { parsePage } from '@metriccanvas/page';
import fixture from '../../page/fixtures/contract-valid/paged-union-page.json';
import { createUnionPreview } from '../../../apps/playground/fixtures/decision-opinion/union-gateway';
import { createSourceProgram, defaultSourceView } from '../src/source-program/session';

function query(): EffectiveQuery {
  return {
    language: 'dqe', filterValues: [],
    body: { dsl_list: [{ output_dims: ['商务审批人'], output_metrics: ['商审审批人决策次数'], order: {} }] },
    fieldMappings: {
      name: { queryField: '商务审批人', type: 'string', role: 'dimension' },
      count: { queryField: '商审审批人决策次数', type: 'number', role: 'measure' }
    },
    pagination: { offset: 0, limit: 200 },
    sort: [{ queryField: '商审审批人决策次数', direction: 'desc' }]
  };
}

describe('metric DQE ordering at the transport boundary', () => {
  it('sends the service single-field syntax, preserving the saved definition', async () => {
    const input = query(), before = structuredClone(input);
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: [], total_count: 0 }] }));
    await createDqeGateway({ fetchImpl }).fetchData(input);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).dsl_list[0].order).toEqual({
      offset: 0, limit: 200, order_by_field: '商审审批人决策次数', type: 'desc'
    });
    expect(input).toEqual(before);
  });
  it('rejects unsupported multiple rules and saved by arrays before HTTP', async () => {
    const fetchImpl = vi.fn<typeof fetch>(), gateway = createDqeGateway({ fetchImpl });
    const multiple = query(); multiple.sort!.push({ queryField: '商务审批人', direction: 'asc' });
    await expect(gateway.fetchData(multiple)).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' });
    const legacy = query(); delete legacy.sort;
    legacy.body.dsl_list[0].order = { by: [{ field: '商审审批人决策次数', type: 'desc', priority: 1 }] };
    await expect(gateway.fetchData(legacy)).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('rejects the camel-case alias on metric and object requests before HTTP', async () => {
    const fetchImpl = vi.fn<typeof fetch>(), gateway = createDqeGateway({ fetchImpl });
    const input = query(); delete input.sort;
    input.body.dsl_list[0].order = { orderByField: '商务审批人', type: 'asc' };
    await expect(gateway.fetchData(input)).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' });
    input.body.dsl_list[0] = { query_type: 'object', object_type: 'demo', output_fields: ['商务审批人'], order: { by: [{ field: '商务审批人', type: 'asc' }] } };
    await expect(gateway.fetchData(input)).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('reads single-field defaults and replaces them atomically on interaction', () => {
    const input = query();
    input.body.dsl_list[0].order = { order_by_field: '商务审批人', type: 'asc', limit: 5 };
    expect(dqeDefaultSort(input.body.dsl_list[0])).toEqual([{ queryField: '商务审批人', direction: 'asc' }]);
    expect(effectiveDqeItem(input).order).toEqual({ order_by_field: '商审审批人决策次数', type: 'desc', offset: 0, limit: 200 });
    delete input.sort;
    expect(effectiveDqeItem(input).order).toEqual({ order_by_field: '商务审批人', type: 'asc', offset: 0, limit: 200 });
  });
  it('does not invent a row-key secondary rule for query children', () => {
    expect(stableRowQuery(query(), 'name').sort).toEqual(query().sort);
    const input = query(); delete input.sort;
    expect(stableRowQuery(input, 'name').sort).toEqual([{ queryField: '商务审批人', direction: 'asc' }]);
  });
  it('merges equal metrics across 200-row HTTP batches without requiring name or key ordering', async () => {
    const parsed = parsePage(fixture); if (!parsed.ok) throw Error('fixture');
    const page = parsed.page, preview = createUnionPreview({ generatedCount: 205 });
    for (const rows of Object.values(preview.data)) {
      rows.reverse();
      for (const row of rows) row.decisionCount = 10;
    }
    const offsets: number[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const results = body.dsl_list.map((item: { output_dims: string[]; order: { offset: number; limit: number; order_by_field: string; type: string; by?: unknown } }) => {
        const member = item.output_dims[0].startsWith('contract_') ? 'contract' : 'commercial';
        expect(item.order).toMatchObject({ order_by_field: `${member}_decision_count`, type: 'desc' });
        expect(item.order.by).toBeUndefined();
        offsets.push(item.order.offset);
        const fields = page.dataSources[member].fields;
        const data = preview.data[member].slice(item.order.offset, item.order.offset + item.order.limit).map(row =>
          Object.fromEntries(Object.entries(fields).map(([id, field]) => ['queryField' in field ? field.queryField : id, row[id.slice(member.length + 1)]])));
        return { code: 'SUCCESS', data, total_count: preview.data[member].length };
      });
      return Response.json({ retCode: 'CBC.0000', results });
    });
    const program = createSourceProgram(page, { gateway: createDqeGateway({ fetchImpl }) });
    try {
      let actual: unknown[] = [];
      for await (const update of program.read({ roots: ['opinions'], conditions: new Map(), views: new Map([['opinions', defaultSourceView(page, 'opinions')]]), purpose: 'complete' })) {
        expect(update.snapshot.status).toBe('ready');
        if (update.snapshot.status === 'ready') actual = update.snapshot.rows.map(row => row.rowKey);
      }
      const expected = [...preview.data.commercial, ...preview.data.contract].map(row => row.rowKey);
      expect(actual).toEqual(expected);
      expect(actual).toHaveLength(418);
      expect(offsets).toContain(200);
    } finally { program.dispose(); }
  });
});
