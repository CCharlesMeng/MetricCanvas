import { describe, expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { isQueryDataSource, type EffectiveQuery, type TableHeaderFilters, type TableSortRule } from '@metriccanvas/page/internal';
import pageDocument from '../../../pages/capabilities/table/decision-opinion-details.json';
import { composeEffectiveQuery } from '../../../packages/data-execution/src/effective-query';
import { sortTableRows } from '../../../packages/data-execution/src/table-view';
import { createDecisionOpinionPreview } from '../fixtures/decision-opinion/preview';
import { createMemberRows, memberLabels, type MemberId } from '../fixtures/decision-opinion/model';
import { createSourceProgram } from '../../../packages/data-execution/src/source-program/session';
import { createCandidateGatewaySession } from '../../../packages/data-execution/src/candidate-session';

function request(pageIndex = 0, type: MemberId | 'all' = 'all', sort: TableSortRule[] = [], pageSize = 20): EffectiveQuery {
  const parsed = parsePage(pageDocument);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const source = parsed.page.dataSources.opinions;
  if (!isQueryDataSource(source)) throw new Error('expected query');
  const headers: TableHeaderFilters = type === 'all' ? {} : { businessType: { mode: 'select', values: [memberLabels[type]] } };
  return composeEffectiveQuery({ dataSource: source, pagination: { limit: pageSize } }, new Map(), pageIndex, sort, headers);
}

describe('决策意见明细 Playground 预览', () => {
  it('保留两类记录、字段映射与后端占比，默认全局降序', async () => {
    const preview = createDecisionOpinionPreview({ generatedCount: 0, delayMs: 0 });
    const result = await preview.dataGateway.fetchData(request(0, 'all', [], 3));
    expect(result.totalCount).toBe(8);
    expect(result.rows.map(row => [row.memberId, row.localRowId])).toEqual([
      ['commercial', '001'], ['contract', '001'], ['commercial', '002']
    ]);
    expect(result.rows.map(row => row.decisionCount)).toEqual([130, 120, 100]);
    expect(result.rows[1].validOpinionRate).toBe(63);
    expect(result.rows[1].validOpinionRate).not.toBe(75);
    expect(new Set(result.rows.map(row => row.rowKey)).size).toBe(3);
  });

  it.each(['decisionCount', 'validOpinionCount', 'validOpinionRate'])('按 %s 升降序跳到末页，与完整结果基准一致', async field => {
    const preview = createDecisionOpinionPreview({ delayMs: 0 });
    const all = [...createMemberRows('contract'), ...createMemberRows('commercial')];
    for (const direction of ['asc', 'desc'] satisfies Array<'asc' | 'desc'>) {
      const sort: TableSortRule[] = [{ field, direction }];
      const expected = sortTableRows(all, [...sort, { field: 'memberId', direction: 'asc' }, { field: 'localRowId', direction: 'asc' }]);
      const result = await preview.dataGateway.fetchData(request(12, 'all', sort));
      expect(result.totalCount).toBe(256);
      expect(result.rows.map(row => row.rowKey)).toEqual(expected.slice(240).map(row => row.rowKey));
    }
    expect(preview.requests.every(item => item.limit === 16)).toBe(true);
    expect(preview.requests.some(item => item.offset > 0)).toBe(true);
  });

  it('表头类型筛选先改变参与集合和总数，未参与的失败来源不执行', async () => {
    const preview = createDecisionOpinionPreview({ delayMs: 0, failMember: 'commercial' });
    const result = await preview.dataGateway.fetchData(request(0, 'contract'));
    expect(result.totalCount).toBe(128);
    expect(result.rows.every(row => row.businessType === '合同')).toBe(true);
    expect(preview.requests.every(item => item.member === 'contract')).toBe(true);
    expect(result.rows[0].decisionCount).toBe(120);
  });

  it('表头候选来自完整匹配范围，打开已筛列仍保留两个类型并支持候选搜索', async () => {
    const parsed = parsePage(pageDocument);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const preview = createDecisionOpinionPreview({ delayMs: 0 });
    const session = createCandidateGatewaySession(preview.dataGateway);
    const program = createSourceProgram(parsed.page, { gateway: session.gateway });
    const input = { sourceId: 'opinions', field: 'businessType', conditions: new Map(),
      view: { pageIndex: 5, pageSize: 20, sort: [], predicates: [{ field: 'businessType', op: 'in', values: ['合同'] }] } } satisfies Parameters<typeof program.readColumnCandidates>[0];
    try {
      expect(await program.readColumnCandidates(input)).toEqual({ kind: 'values', candidates: [
        { value: '合同', label: '合同' }, { value: '商务', label: '商务' }
      ], totalCount: 2 });
      expect(await program.readColumnCandidates({ ...input, candidateSearch: '商' })).toEqual({ kind: 'values', candidates: [
        { value: '商务', label: '商务' }
      ], totalCount: 1 });
      expect(await program.readColumnCandidates({ ...input, candidateSearch: '不存在' })).toEqual({ kind: 'values', candidates: [], totalCount: 0 });
    } finally { program.dispose(); session.dispose(); }
  });

  it('类型多选与清空筛选恢复全部匹配结果', async () => {
    const preview = createDecisionOpinionPreview({ delayMs: 0 });
    const both = request();
    both.filterValues = [{ target: 'dimension', queryField: 'business_type', values: ['合同', '商务'] }];
    expect((await preview.dataGateway.fetchData(both)).totalCount).toBe(256);
    expect((await preview.dataGateway.fetchData(request(0, 'contract'))).totalCount).toBe(128);
    expect((await preview.dataGateway.fetchData(request())).totalCount).toBe(256);
  });

  it('占比按后端值排序，升序降序的 null 都排尾', async () => {
    const preview = createDecisionOpinionPreview({ generatedCount: 0, delayMs: 0 });
    const desc = await preview.dataGateway.fetchData(request(0, 'all', [{ field: 'validOpinionRate', direction: 'desc' }]));
    const asc = await preview.dataGateway.fetchData(request(0, 'all', [{ field: 'validOpinionRate', direction: 'asc' }]));
    expect(desc.rows.map(row => row.validOpinionRate)).toEqual([88, 87.5, 80, 75, 70, 63, 20, null]);
    expect(asc.rows.map(row => row.validOpinionRate)).toEqual([20, 63, 70, 75, 80, 87.5, 88, null]);
  });

  it('缓存页与返回值隔离，重复读取不重扫，切换类型和排序不串结果', async () => {
    const preview = createDecisionOpinionPreview({ delayMs: 0 });
    const first = await preview.dataGateway.fetchData(request());
    const calls = preview.requests.length;
    first.rows[0].decisionCount = -1;
    expect((await preview.dataGateway.fetchData(request())).rows[0].decisionCount).toBe(130);
    expect(preview.requests.length).toBe(calls);
    const contract = await preview.dataGateway.fetchData(request(0, 'contract'));
    expect(contract.totalCount).toBe(128);
    const sorted = await preview.dataGateway.fetchData(request(0, 'all', [{ field: 'validOpinionCount', direction: 'desc' }]));
    expect(sorted.rows[0].validOpinionCount).toBe(91);
  });

  it('任一参与来源失败则整轮拒绝，不返回半份结果', async () => {
    const preview = createDecisionOpinionPreview({ failMember: 'contract', delayMs: 0 });
    await expect(preview.dataGateway.fetchData(request())).rejects.toMatchObject({ code: 'DQE_TIMEOUT' });
  });

  it('超过八页缓存后淘汰旧页，重新访问时按分页端口恢复', async () => {
    const preview = createDecisionOpinionPreview({ delayMs: 0 });
    for (let index = 0; index < 9; index++) await preview.dataGateway.fetchData(request(index));
    const calls = preview.requests.length;
    expect((await preview.dataGateway.fetchData(request())).rows[0].decisionCount).toBe(130);
    expect(preview.requests.length).toBeGreaterThan(calls);
  });

  it('取消中止归并，后续新视图仍能正常读取', async () => {
    const preview = createDecisionOpinionPreview({ delayMs: 5 });
    const controller = new AbortController();
    const pending = preview.dataGateway.fetchData(request(12), undefined, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'DQE_CANCELLED' });
    expect((await preview.dataGateway.fetchData(request(0, 'commercial'))).totalCount).toBe(128);
  });

  it('未知查询、未知排序和非法窗口不能转发给真实服务', async () => {
    const preview = createDecisionOpinionPreview({ delayMs: 0 });
    const unknown = request();
    unknown.body = { dsl_list: [{ output_dims: ['unknown'] }] };
    await expect(preview.dataGateway.fetchData(unknown)).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' });
    const badSort = request();
    badSort.sort = [{ queryField: 'unknown', direction: 'desc' }];
    await expect(preview.dataGateway.fetchData(badSort)).rejects.toMatchObject({ code: 'DQE_QUERY_REJECTED' });
    const badWindow = request();
    badWindow.pagination = { offset: -1, limit: 20 };
    await expect(preview.dataGateway.fetchData(badWindow)).rejects.toMatchObject({ code: 'DQE_QUERY_REJECTED' });
    expect(preview.requests).toHaveLength(0);
  });
});
