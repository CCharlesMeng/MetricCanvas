import type { DataGateway } from '../../../../packages/data-execution/src/ports';
import type { EffectiveQuery, Row } from '@metriccanvas/page/internal';
import { filterTableRows, searchTableRows, sortTableRows } from '../../../../packages/data-execution/src/table-view';
import { createMemberRows, type MemberId } from './model';

/** Ordinary independent pageable query endpoints; the product SourceProgram owns merging. */
export function createUnionPreview(options: { generatedCount?: number; failMember?: MemberId; delayMs?: number } = {}) {
  const requests: EffectiveQuery[] = [];
  const data = { contract: createMemberRows('contract', options.generatedCount), commercial: createMemberRows('commercial', options.generatedCount) };
  function rows(query: EffectiveQuery): Row[] {
    const member: MemberId = Object.keys(query.fieldMappings).some(field => field.startsWith('contract-')) ? 'contract' : 'commercial';
    if (member === options.failMember) throw Object.assign(new Error('合成来源不可用'), { code: 'DQE_TRANSPORT_ERROR' });
    const mapping = (queryField: string) => Object.entries(query.fieldMappings).find(([, field]) => 'queryField' in field && field.queryField === queryField)?.[0] ?? '';
    let result = data[member].map(raw => Object.fromEntries(Object.keys(query.fieldMappings).map(field => [field, raw[field.slice(member.length + 1)]])));
    for (const predicate of query.filterValues) {
      if (predicate.target === 'dimension') result = filterTableRows(result, [{ field: mapping(predicate.queryField), op: 'in', values: predicate.values }]);
      else if (predicate.target === 'metricRange') {
        if (predicate.from !== undefined) result = filterTableRows(result, [{ field: mapping(predicate.metric), op: 'gte', value: predicate.from }]);
        if (predicate.to !== undefined) result = filterTableRows(result, [{ field: mapping(predicate.metric), op: 'lte', value: predicate.to }]);
      }
      else if (predicate.target === 'dimensionRange') result = filterTableRows(result, [{ field: mapping(predicate.queryField), op: 'dateRange', from: predicate.from, to: predicate.to }]);
    }
    if (query.search) result = searchTableRows(result, query.search.queryFields.map(mapping), query.search.query, query.search.match);
    return sortTableRows(result, (query.sort ?? []).map(rule => ({ field: mapping(rule.queryField), direction: rule.direction })));
  }
  const dataGateway: DataGateway = {
    async fetchData(query, _diagnostics, signal) {
      signal?.throwIfAborted();
      if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
      signal?.throwIfAborted(); requests.push(structuredClone(query));
      const matching = rows(query), window = query.pagination;
      return { rows: window ? matching.slice(window.offset, window.offset + window.limit) : matching, totalCount: matching.length };
    },
    async fetchColumnCandidates(request, _diagnostics, signal) {
      signal?.throwIfAborted();
      const values = new Map<string, string | number>();
      for (const row of rows(request.query)) {
        const value = row[request.field];
        if (typeof value === 'string' || typeof value === 'number') values.set(JSON.stringify(value), value);
      }
      const candidates = [...values.values()].filter(value => String(value).toLowerCase().includes(request.search.toLowerCase())).sort().map(value => ({ value, label: String(value) }));
      return { kind: 'values', candidates: candidates.slice(request.offset, request.offset + request.limit), totalCount: candidates.length };
    }
  };
  return { dataGateway, requests, data };
}
