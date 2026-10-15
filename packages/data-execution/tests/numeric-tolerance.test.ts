import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/query-numeric-tolerance.json';
import joinFixture from '../../page/fixtures/contract-valid/paged-join-page.json';
import { parsePage, versionPolicy, type PageDocument } from '@metriccanvas/page';
import type { DataSnapshot, EffectiveQuery } from '@metriccanvas/page/internal';
import { createDqeGateway, createInMemoryDqeDiagnostics } from '../src/dqe';
import { createPageDataExecutor } from '../src';
import { createSourceProgram, initialFilterValues } from '../src/runtime';
import { applyComputation } from '../src/compute';
import { officeGateway } from './fixtures/office-gateway';
import { executeDqeItem } from '../../../tools/dqe-sim/src/execute';
import { lineOption } from '../../engine/widgets/src/components/line-chart/options';
import { formatValue } from '../../engine/widgets/src/shared/value-format';

const expected = [10, null, null, 12.5, 0, -4, null, null];
const document = (): PageDocument => JSON.parse(JSON.stringify(fixture));

function gateway() {
  const diagnostics = createInMemoryDqeDiagnostics();
  let requests = 0;
  const result = createDqeGateway({ diagnostics, fetchImpl: (async (_url, options) => {
    requests++;
    const body = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ retCode: 'CBC.0000', results: body.dsl_list.map(executeDqeItem) }));
  }) as typeof fetch });
  return { result, diagnostics, requests: () => requests };
}

async function read(input: PageDocument, useInitial: boolean, transport: ReturnType<typeof gateway>) {
  const parsed = parsePage(input);
  expect(parsed.errors).toEqual([]);
  if (!parsed.ok) throw Error('验收页面无法解析');
  const program = createSourceProgram(parsed.page, { gateway: transport.result });
  let snapshot: DataSnapshot | undefined;
  try {
    for await (const update of program.read({ roots: ['samples'], conditions: initialFilterValues(parsed.page.filters ?? []), useInitial })) snapshot = update.snapshot;
  } finally { program.dispose(); }
  expect(snapshot?.status).toBe('ready');
  if (snapshot?.status !== 'ready') throw Error('数值异常阻断有效数据');
  return { rows: snapshot.rows, page: parsed.page, snapshot };
}

describe('完整页面的查询数值容错', () => {
  it('原始初始行中的对象、数组和非有限数字也能到达数值归一化接缝', async () => {
    for (const value of [{ invalid: true }, [1, 2], NaN, Infinity]) {
      const input = JSON.parse(JSON.stringify(fixture));
      input.dataSources.samples.source.initial.rows[0]['容错数值'] = value;
      input.dataSources.samples.source.initial.rows[0]['容错明细'][0]['明细数值'] = value;
      const result = await read(input, true, gateway());
      expect(result.rows[0].value).toBeNull();
      expect(result.rows[0].details).toEqual([{ label: '示例', value: null }]);
      expect(result.rows).toHaveLength(8);
    }
  });

  it('首屏与动态 DQE 使用同一页面；全部行、计算和图表缺口一致', async () => {
    const transport = gateway(), input = document(), original = structuredClone(input);
    const initial = await read(input, true, transport);
    expect(transport.requests()).toBe(0);
    const dynamic = await read(input, false, transport);
    expect(transport.requests()).toBe(1);
    expect(dynamic.rows).toEqual(initial.rows);
    expect(dynamic.rows.map(row => row.value)).toEqual(expected);
    expect(dynamic.rows.map(row => row.rate)).toEqual([10, null, null, 12.5, 0, -4, null, null]);
    expect(dynamic.rows.map(row => row.amount)).toEqual([100, null, null, 1250.5, 0, -40, null, null]);
    expect(dynamic.rows[1].details).toEqual([{ label: '示例', value: null }]);
    expect(dynamic.rows[3].details).toEqual([{ label: '示例', value: 3.5 }]);
    expect(dynamic.rows.map(row => formatValue(row.value, 'number-1'))).toEqual(['10.0', '—', '—', '12.5', '0.0', '-4.0', '—', '—']);
    const component = dynamic.page.sections[0].components.find(c => c.type === 'lineChart');
    if (component?.type !== 'lineChart') throw Error('页面缺少图表验收配置');
    const option = lineOption({ main: { fields: dynamic.page.dataSources.samples.fields, snapshot: dynamic.snapshot } }, component.props);
    expect(option.series).toMatchObject([{ data: expected }]);
    expect(input).toEqual(original);
    const records = transport.diagnostics.records();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ status: 'success', rowCount: 8, totalCount: 8,
      warnings: expect.arrayContaining([{ fieldId: 'value', queryField: '容错数值', code: 'INVALID_NUMERIC_VALUE', count: 3 },
        { fieldId: 'value', queryField: '容错数值', code: 'NUMERIC_NULL_NOT_ALLOWED', count: 1 }]) });
    expect(JSON.stringify(records)).not.toContain('占位符');
    expect(JSON.stringify(records)).not.toContain('示例');
  });

  it('执行后保存和重开仍成功；合计不受单个缺失污染', async () => {
    const transport = gateway();
    const output = await createPageDataExecutor({ gateway: transport.result }).execute(document());
    expect(parsePage(output).errors).toEqual([]);
    const reopened = await read(JSON.parse(JSON.stringify(output)), true, transport);
    expect(reopened.rows.map(row => row.value)).toEqual(expected);
    expect(transport.requests()).toBe(1);
    const summed = applyComputation([{ op: 'grandTotal', measures: ['value'], rowKind: { field: 'kind', value: 'total' }, label: { field: 'sample', value: '合计' } }], reopened.rows);
    expect(summed.at(-1)?.value).toBe(18.5);
  });

  it('组合表格允许已归一化的缺失度量通过成员、投影与初始行复验', async () => {
    const joinDocument: PageDocument = JSON.parse(JSON.stringify({ ...joinFixture, schemaVersion: versionPolicy.current }));
    const parsed = parsePage(joinDocument);
    if (!parsed.ok) throw Error('组合表夹具');
    const office = officeGateway();
    const program = createSourceProgram(parsed.page, { gateway: { async fetchData(query: EffectiveQuery) {
      const result = await office.fetchData(query);
      if ('bidding-amount' in query.fieldMappings) result.rows = result.rows.map(row => ({ ...row, 'bidding-amount': null }));
      return result;
    } } });
    try {
      for await (const update of program.read({ roots: ['office-overview'], conditions: initialFilterValues(parsed.page.filters ?? []) })) {
        if (update.sourceId !== 'office-overview') continue;
        expect(update.snapshot.status).toBe('ready');
        if (update.snapshot.status === 'ready') expect(update.snapshot.rows.every(row => row['bidding-amount'] === null)).toBe(true);
        if (update.initial) {
          const output = structuredClone(joinDocument);
          const source = output.dataSources['office-overview'].source;
          if (source.type === 'pagedJoin' && 'view' in update.initial) source.initial = update.initial;
          expect(parsePage(output).errors).toEqual([]);
        }
      }
    } finally { program.dispose(); }
  });
});
