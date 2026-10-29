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
    expect(snapshot?.status).toBe('error');
    if (snapshot?.status !== 'error') throw Error('expected error');
    expect(snapshot.error.code).toBe('DQE_ROW_CONTRACT_ERROR');
    expect(log).toHaveBeenCalledWith(expect.stringContaining(snapshot.error.message), expect.objectContaining({ message: snapshot.error.message }));
    return snapshot.error.message;
  } finally { program.dispose(); log.mockRestore(); }
}

describe('pagedUnion errors locate the member without exposing row values', () => {
  it('identifies both source row numbers and the rowKey declaration for a duplicate within a batch', async () => {
    const message = await failure(rows => {
      rows[0]['commercial-localRowId'] = 'PRIVATE-KEY';
      rows[1]['commercial-localRowId'] = 'PRIVATE-KEY';
    });
    const summary = message.split('\n')[0];
    expect(summary).toBe('“审批统计明细”无法合并数据。同一个查询返回的第 1 条和第 2 条记录，“来源内编码”相同。页面用这个字段区分每条记录，因此不能重复。请改用能区分每条记录的字段。');
    expect(summary).not.toMatch(/commercial|rowKey|offset|queryField/);
    for (const part of ['合并源 opinions', '成员 commercial', '来源 commercial', 'commercial-localRowId', 'commercial_local_row_id', '/dataSources/opinions/source/members/commercial/rowKey', 'offset=0']) expect(message).toContain(part);
    expect(message).not.toContain('PRIVATE-KEY');
  });
  it('distinguishes overlap across 200-row batches and retains the first source row number', async () => {
    const message = await failure((rows, offset) => {
      rows[0]['commercial-localRowId'] = 'PRIVATE-CROSS-BATCH';
      if (offset === 0) return;
      rows[0]['commercial-decisionCount'] = 0;
    }, 230, 1000);
    expect(message).toContain('第 1 条和第 201 条记录，“来源内编码”相同');
    expect(message).toContain('请检查查询是否重复返回了数据');
    expect(message).toContain('offset=200');
    expect(message).not.toContain('PRIVATE-CROSS-BATCH');
  });
  it('locates missing source keys', async () => {
    const message = await failure(rows => { rows[1]['commercial-localRowId'] = null; });
    expect(message).toContain('第 2 条记录没有有效的“来源内编码”');
    expect(message).toContain('成员 commercial');
    expect(message).toContain('commercial-localRowId');
  });
  it('locates incompatible source order', async () => {
    const message = await failure(rows => { rows.reverse(); });
    expect(message).toContain('第 1 条和第 2 条记录顺序不符合表格要求');
    expect(message).toContain('“决策总次数”从大到小');
    expect(message).toContain('成员 commercial');
    expect(message).toContain('decisionCount');
  });
  it('locates a malformed key rejected before row projection', async () => {
    const message = await failure(rows => { rows[1]['commercial-localRowId'] = 42; });
    expect(message).toContain('第 2 条记录中的“来源内编码”不符合页面要求的数据格式');
    expect(message).toContain('TYPE_MISMATCH');
    expect(message).toContain('来源 commercial');
    expect(message).toContain('/dataSources/opinions/source/members/commercial/rowKey');
  });
});
