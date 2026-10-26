import { describe, expect, it } from 'vitest';
import { parsePage, resolvePageParams } from '@metriccanvas/page';
import type { DataSnapshot, Page, Row, TableQueryView } from '@metriccanvas/page/internal';
import { rowCellFallback } from '@metriccanvas/page/internal';
import fixture from '../../page/fixtures/contract-valid/paged-union-page.json';
import { createUnionPreview } from '../../../apps/playground/fixtures/decision-opinion/union-gateway';
import { createSourceProgram, defaultSourceView } from '../src/source-program/session';
import { createPageDataExecutor } from '../src/execute';
import { sortTableRows } from '../src/table-view';
import type { DataGateway } from '../src/ports';

function page(): Page { const result = parsePage(fixture); if (!result.ok) throw Error(JSON.stringify(result.errors)); return result.page; }
function rows(snapshot: DataSnapshot | undefined): Row[] { if (snapshot?.status !== 'ready') throw Error(JSON.stringify(snapshot)); return snapshot.rows; }
async function read(program: ReturnType<typeof createSourceProgram>, p: Page, view: Partial<TableQueryView> = {}, purpose: 'screen' | 'complete' = 'screen', signal?: AbortSignal) {
  let result: DataSnapshot | undefined;
  for await (const update of program.read({ roots: ['opinions'], conditions: new Map(), views: new Map([['opinions', { ...defaultSourceView(p, 'opinions'), ...view }]]), purpose, signal })) result = update.snapshot;
  return result;
}
describe('pagedUnion through the shared SourceProgram', () => {
  it('preserves scalar display evidence across projection, export and captured initial rows', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 0 });
    const evidence = { raw: '原始占比', reason: 'TYPE_MISMATCH' as const };
    const gateway: DataGateway = { async fetchData(query, diagnostics, signal) {
      const result = await preview.dataGateway.fetchData(query, diagnostics, signal);
      const index = result.rows.findIndex(row => row['contract-localRowId'] === '004');
      if (index >= 0) result.cellFallbacks = { [index]: { 'contract-validOpinionRate': evidence } };
      return result;
    } };
    const program = createSourceProgram(p, { gateway });
    try {
      for (const purpose of ['screen', 'complete'] as const) {
        const result = await read(program, p, {}, purpose);
        const index = rows(result).findIndex(row => row.memberId === 'contract' && row.localRowId === '004');
        expect(rowCellFallback(rows(result)[index], 'validOpinionRate')).toEqual(evidence);
        expect(result?.status === 'ready' && result.cellFallbacks?.[index]?.validOpinionRate).toEqual(evidence);
      }
    } finally { program.dispose(); }
    const resolved = resolvePageParams(fixture); if (!resolved.ok) throw Error('fixture');
    const output = await createPageDataExecutor({ gateway }).execute(resolved.document);
    const source = output.dataSources.opinions.source;
    if (source.type !== 'pagedUnion') throw Error('union source');
    const initial = source.initial;
    expect('view' in initial! && Object.values(initial.cellFallbacks ?? {}).some(cells => cells.validOpinionRate?.raw === evidence.raw)).toBe(true);
  });
  it('maps distinct source fields, interleaves the global first page, and preserves backend ratios', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 0 }), program = createSourceProgram(p, { gateway: preview.dataGateway });
    try {
      const result = await read(program, p, { pageSize: 3 });
      expect(rows(result).map(row => [row.memberId, row.localRowId, row.decisionCount])).toEqual([['commercial','001',130], ['contract','001',120], ['commercial','002',100]]);
      expect(rows(result)[1].validOpinionRate).toBe(63);
      expect(result).toMatchObject({ totalCount: 8 });
      expect(rows(result)[0].missingNote).toBeNull();
    } finally { program.dispose(); }
  });
  it('keeps identical business records from both sources and uses distinct global identities', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 0 });
    preview.data.commercial.splice(0, 4, ...structuredClone(preview.data.contract));
    const program = createSourceProgram(p, { gateway: preview.dataGateway });
    try {
      const result = rows(await read(program, p, {}, 'complete'));
      expect(result).toHaveLength(8); expect(new Set(result.map(row => row.rowKey)).size).toBe(8);
      expect(result.filter(row => row.localRowId === '001').map(row => row.decisionCount)).toEqual([120,120]);
    } finally { program.dispose(); }
  });
  it('matches an independent whole-population baseline across batches, reverse paging and checkpoint resume', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 530 }), program = createSourceProgram(p, { gateway: preview.dataGateway });
    const all = Object.values(preview.data).flat();
    try {
      for (const field of ['decisionCount', 'validOpinionRate']) for (const direction of ['asc', 'desc'] as const) {
        const sort = [{ field, direction }], expected = sortTableRows(all, [...sort, { field: 'memberId', direction: 'asc' }, { field: 'localRowId', direction: 'asc' }]);
        for (const pageIndex of [0, 14, 15, 4, 53]) {
          const result = await read(program, p, { sort, pageSize: 20, pageIndex });
          expect(rows(result).map(row => [row.memberId,row.localRowId])).toEqual(expected.slice(pageIndex * 20, pageIndex * 20 + 20).map(row => [row.memberId,row.localRowId]));
        }
      }
      expect(preview.requests.some(query => (query.pagination?.offset ?? 0) > 0)).toBe(true);
    } finally { program.dispose(); }
  });
  it('pushes predicates and search before count and paging; constants can exclude a failed source', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 0, failMember: 'commercial' }), program = createSourceProgram(p, { gateway: preview.dataGateway });
    try {
      const result = await read(program, p, { predicates: [{ field: 'businessType', op: 'in', values: ['合同'] }, { field: 'decisionCount', op: 'gte', value: 100 }], search: { fields: ['approver','region'], query: '审批人' } });
      expect(result).toMatchObject({ totalCount: 3 });
      expect(rows(result).every(row => row.businessType === '合同')).toBe(true);
      expect(preview.requests.every(query => Object.keys(query.fieldMappings).some(field => field.startsWith('contract-')))).toBe(true);
      expect((await read(program, p))?.status).toBe('error');
    } finally { program.dispose(); }
  });
  it('searches literal projections and null never matches a normal value predicate', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 0 }), program = createSourceProgram(p, { gateway: preview.dataGateway });
    try {
      const result = await read(program, p, { search: { fields: ['missingNote'], query: '专属' } });
      expect(result).toMatchObject({ totalCount: 4 });
      expect(rows(result).every(row => row.memberId === 'contract')).toBe(true);
      expect(await read(program, p, { predicates: [{ field: 'missingNote', op: 'in', values: ['不存在'] }] })).toMatchObject({ status: 'empty', totalCount: 0 });
    } finally { program.dispose(); }
  });
  it('unions full-domain distinct candidates while removing only the candidate column predicate', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 0 }), program = createSourceProgram(p, { gateway: preview.dataGateway });
    try {
      const request = { sourceId: 'opinions', conditions: new Map(), view: { ...defaultSourceView(p, 'opinions'), predicates: [{ field: 'businessType', op: 'in' as const, values: ['合同'] }] } };
      expect(await program.readColumnCandidates({ ...request, field: 'businessType' })).toMatchObject({ kind: 'values', totalCount: 2 });
      const names = await program.readColumnCandidates({ ...request, field: 'approver' });
      expect(names).toMatchObject({ kind: 'values', totalCount: 3 });
      const missing = await program.readColumnCandidates({ ...request, field: 'missingNote', view: defaultSourceView(p, 'opinions') });
      expect(missing).toMatchObject({ kind: 'values', candidates: [{ value: '合同专属说明', label: '合同专属说明' }], totalCount: 1 });
    } finally { program.dispose(); }
  });
  it('corrects an out-of-range page and produces a valid reusable union initial without executing independent members', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 0 }), program = createSourceProgram(p, { gateway: preview.dataGateway });
    try { expect(rows(await read(program, p, { pageIndex: 50, pageSize: 3 }))).toHaveLength(2); } finally { program.dispose(); }
    const resolved = resolvePageParams(fixture); if (!resolved.ok) throw Error('fixture');
    const output = await createPageDataExecutor({ gateway: preview.dataGateway }).execute(resolved.document);
    expect(output.dataSources.opinions.source).toHaveProperty('initial.rows');
    expect(output.dataSources.contract.source).not.toHaveProperty('initial');
    expect(parsePage(output).errors).toEqual([]);
  });
  it('rejects duplicate source keys, missing count, and streams ordered with incompatible null placement', async () => {
    for (const failure of ['duplicate', 'count', 'order']) {
      const p = page(), preview = createUnionPreview({ generatedCount: 0 });
      const gateway: DataGateway = { async fetchData(query) {
        const result = await preview.dataGateway.fetchData(query);
        if (failure === 'duplicate' && result.rows[1]) result.rows[1] = result.rows[0];
        if (failure === 'count') delete result.totalCount;
        if (failure === 'order') result.rows.reverse();
        return result;
      } };
      const program = createSourceProgram(p, { gateway });
      try { expect(await read(program, p)).toMatchObject({ status: 'error', error: { code: 'DQE_ROW_CONTRACT_ERROR' } }); } finally { program.dispose(); }
    }
  });
  it('exports all matched rows and rejects over-limit exports without a partial file', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 0 }), program = createSourceProgram(p, { gateway: preview.dataGateway });
    try { expect(rows(await read(program, p, { pageIndex: 1, pageSize: 3 }, 'complete'))).toHaveLength(8); } finally { program.dispose(); }
    const large = createSourceProgram(p, { gateway: createUnionPreview({ generatedCount: 5100 }).dataGateway });
    try { await expect(read(large, p, {}, 'complete')).rejects.toMatchObject({ code: 'EXPORT_ROW_LIMIT' }); } finally { large.dispose(); }
  });
  it('cancels pending source reads without publishing a successful result', async () => {
    const p = page(), preview = createUnionPreview({ delayMs: 30 }), program = createSourceProgram(p, { gateway: preview.dataGateway }), controller = new AbortController();
    const pending = read(program, p, {}, 'screen', controller.signal); controller.abort();
    try { await expect(pending).rejects.toBeDefined(); } finally { program.dispose(); }
  });
  it('retries a changed member count once using fresh batches, then fails repeated changes', async () => {
    for (const persistent of [false, true]) {
      const p = page(), preview = createUnionPreview({ generatedCount: 430 });
      let changes = 0;
      const gateway: DataGateway = { async fetchData(query) {
        const result = await preview.dataGateway.fetchData(query);
        if ((query.pagination?.offset ?? 0) > 0 && (persistent || changes === 0)) { result.totalCount! += 1; changes++; }
        return result;
      } };
      const program = createSourceProgram(p, { gateway });
      try {
        const result = await read(program, p, { pageIndex: 40 });
        if (persistent) expect(result).toMatchObject({ status: 'error', error: { code: 'DQE_QUERY_REJECTED' } });
        else expect(result).toMatchObject({ status: 'ready', totalCount: 868 });
        expect(changes).toBeGreaterThan(0);
      } finally { program.dispose(); }
    }
  });
  it('isolates ordinary consumers and resumes a checkpoint without dropping its unconsumed buffer', async () => {
    const p = page(), preview = createUnionPreview({ generatedCount: 430 }), program = createSourceProgram(p, { gateway: preview.dataGateway });
    try {
      await read(program, p);
      const calls = preview.requests.length;
      const next = rows(await read(program, p, { pageIndex: 1 }));
      expect(preview.requests).toHaveLength(calls);
      const fresh = createSourceProgram(p, { gateway: preview.dataGateway });
      try { expect(rows(await read(fresh, p, { pageIndex: 1 }))).toEqual(next); } finally { fresh.dispose(); }
      let independent: DataSnapshot | undefined;
      for await (const update of program.read({ roots: ['contract'], conditions: new Map() })) independent = update.snapshot;
      expect(rows(independent)).toHaveLength(434);
    } finally { program.dispose(); }
  });
  it('reads a million-row source through bounded batches and rejects a cold page past the scan limit', async () => {
    const p = page();
    const calls: number[] = [];
    const gateway: DataGateway = { async fetchData(query) {
      const offset = query.pagination?.offset ?? 0, limit = query.pagination?.limit ?? 200;
      calls.push(limit);
      return { totalCount: 1_000_000, rows: Array.from({ length: limit }, (_, index) => Object.fromEntries(Object.entries(query.fieldMappings).map(([field, definition]) =>
        [field, definition.type === 'number' ? 1_000_000 - offset - index : field.endsWith('localRowId') ? String(offset + index).padStart(8, '0') : '合成值']))) };
    } };
    const program = createSourceProgram(p, { gateway });
    try {
      expect(await read(program, p)).toMatchObject({ status: 'ready', totalCount: 2_000_000 });
      expect(calls).toEqual([200, 200]);
      expect(await read(program, p, { pageIndex: 6000 })).toMatchObject({ status: 'error', error: { code: 'DQE_QUERY_REJECTED' } });
      expect(calls).toHaveLength(2);
    } finally { program.dispose(); }
  });

});
