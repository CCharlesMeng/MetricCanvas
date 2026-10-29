import { describe, expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import type { DataSnapshot, Row } from '@metriccanvas/page/internal';
import fixture from '../../page/fixtures/contract-valid/paged-union-page.json';
import { createUnionPreview } from '../../../apps/playground/fixtures/decision-opinion/union-gateway';
import { createSourceProgram, defaultSourceView } from '../src/source-program/session';
import type { DataGateway } from '../src/ports';

async function failure(transform: (rows: Row[], offset: number) => void, generatedCount = 0, pageSize = 20) {
  const parsed = parsePage(fixture);
  if (!parsed.ok) throw Error('fixture');
  const preview = createUnionPreview({ generatedCount });
  const gateway: DataGateway = { async fetchData(query) {
    const result = await preview.dataGateway.fetchData(query);
    if ('commercial-localRowId' in query.fieldMappings) transform(result.rows, query.pagination?.offset ?? 0);
    return result;
  } };
  const program = createSourceProgram(parsed.page, { gateway });
  let snapshot: DataSnapshot | undefined;
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    for await (const update of program.read({ roots: ['opinions'], conditions: new Map(), views: new Map([
      ['opinions', { ...defaultSourceView(parsed.page, 'opinions'), pageSize }]
    ]) })) snapshot = update.snapshot;
    expect(snapshot).toMatchObject({status:'ready',warnings:expect.any(Array)});
    if (snapshot?.status !== 'ready') throw Error('expected recovered result');
    expect(log).not.toHaveBeenCalled();
    return JSON.stringify(snapshot.warnings);
  } finally { program.dispose(); log.mockRestore(); }
}

describe('pagedUnion recovery warnings locate the source without exposing row values', () => {
  it('reports duplicate recovery for its source', async () => {
    const message = await failure(rows => {
      rows[0]['commercial-localRowId'] = 'PRIVATE-KEY';
      rows[1]['commercial-localRowId'] = 'PRIVATE-KEY';
    });
    expect(message).toContain('commercial');
    expect(message).toContain('重复行标识仅保留第一条');
    expect(message).not.toContain('PRIVATE-KEY');
  });
  it('reports overlap across 200-row batches', async () => {
    const message = await failure((rows, offset) => {
      rows[0]['commercial-localRowId'] = 'PRIVATE-CROSS-BATCH';
      if (offset === 0) return;
      rows[0]['commercial-decisionCount'] = 0;
    }, 230, 1000);
    expect(message).toContain('重复行标识仅保留第一条');
    expect(message).toContain('commercial');
    expect(message).not.toContain('PRIVATE-CROSS-BATCH');
  });
  it('locates missing source keys', async () => {
    const message = await failure(rows => { rows[1]['commercial-localRowId'] = null; });
    expect(message).toContain('已跳过无效行或缺失行标识');
    expect(message).toContain('commercial');
  });
  it('reports complete sorting after incompatible source order', async () => {
    const message = await failure(rows => { rows.reverse(); });
    expect(message).toContain('已按可用数据重新整理');
    expect(message).toContain('commercial');
  });
  it('locates a malformed key rejected before row projection', async () => {
    const message = await failure(rows => { rows[1]['commercial-localRowId'] = 42; });
    expect(message).toContain('已跳过无效行或缺失行标识');
    expect(message).toContain('commercial');
    expect(message).not.toContain('42');
  });
});
