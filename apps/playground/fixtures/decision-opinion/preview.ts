import { effectiveDqeItem } from '../../../../packages/data-execution/src/dqe/dqe';
import { dqeDefaultSort } from '@metriccanvas/page/internal';
import type { DataGateway, DataGatewayResult } from '@metriccanvas/engine';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { memberIds, memberLabels, type MemberId, type SortField, type SortRule } from './model';
import { createMemberReader, previewError, type PreviewOptions } from './member-source';
import { mergeOpinionPage } from './merge';

const sortableFields: Record<string, SortField> = {
  decision_count: 'decisionCount', valid_opinion_count: 'validOpinionCount', valid_opinion_rate: 'validOpinionRate'
};

function querySort(query: EffectiveQuery): SortRule[] {
  const rules = dqeDefaultSort(effectiveDqeItem(query));
  if (!rules.length) throw previewError('DQE_CONFIG_ERROR', '合成查询缺少默认排序');
  return rules.map(rule => {
    const field = sortableFields[rule.queryField];
    if (!field || (rule.direction !== 'asc' && rule.direction !== 'desc')) throw previewError('DQE_QUERY_REJECTED', '合成排序字段不受支持');
    return { field, direction: rule.direction };
  });
}

function queryMembers(query: EffectiveQuery): MemberId[] {
  let selected = [...memberIds];
  for (const predicate of query.filterValues) {
    if (predicate.target !== 'dimension' || predicate.queryField !== 'business_type') throw previewError('DQE_QUERY_REJECTED', '合成筛选字段不受支持');
    selected = selected.filter(member => predicate.values.includes(memberLabels[member]));
  }
  return selected;
}

function queryWindow(query: EffectiveQuery) {
  const window = query.pagination;
  if (!window || !Number.isSafeInteger(window.offset) || window.offset < 0 || !Number.isSafeInteger(window.limit) || window.limit < 1 || window.limit > 200) {
    throw previewError('DQE_QUERY_REJECTED', '合成查询分页窗口无效');
  }
  return window;
}

/** Playground-only adapter prototype, not a pagedUnion product protocol. */
export function createDecisionOpinionPreview(options: PreviewOptions = {}) {
  const source = createMemberReader(options);
  const pages = new Map<string, DataGatewayResult>();
  const dataGateway: DataGateway = {
    async fetchColumnCandidates(request, _diagnostics, signal) {
      signal?.throwIfAborted();
      if (request.field !== 'businessType' || request.queryField !== 'business_type') return { kind: 'unavailable' };
      const members = queryMembers(request.query), sort = querySort(request.query);
      const totals = await Promise.all(members.map(member => source.read({ member, offset: 0, limit: 1, sort }, signal ?? new AbortController().signal)));
      const term = request.search.trim().toLowerCase();
      const candidates = members.filter((member, index) => totals[index]!.totalCount > 0 && memberLabels[member].toLowerCase().includes(term))
        .map(member => ({ value: memberLabels[member], label: memberLabels[member] }));
      return { kind: 'values', candidates: candidates.slice(request.offset, request.offset + request.limit), totalCount: candidates.length };
    },
    async fetchData(query, _diagnostics, parentSignal) {
      parentSignal?.throwIfAborted();
      const dimensions = query.body.dsl_list[0].output_dims;
      if (!Array.isArray(dimensions) || !dimensions.includes('opinion_row_key')) throw previewError('DQE_CONFIG_ERROR', '此适配器仅接受审批统计合成查询');
      const sort = querySort(query), members = queryMembers(query), window = queryWindow(query);
      const key = JSON.stringify([members, sort, window]);
      const cached = pages.get(key);
      if (cached) return structuredClone(cached);
      const controller = new AbortController();
      const signal = parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal;
      try {
        const result = await mergeOpinionPage({ members, sort, ...window, batchSize: 16 }, source.read, signal);
        signal.throwIfAborted();
        pages.set(key, structuredClone(result));
        if (pages.size > 8) pages.delete(pages.keys().next().value!);
        return result;
      } catch (cause) {
        controller.abort();
        throw cause;
      }
    }
  };
  return { dataGateway, requests: source.requests };
}
