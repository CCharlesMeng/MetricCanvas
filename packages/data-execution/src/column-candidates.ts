import { canonicalizeJson, type Row, type TableQueryView } from '@metriccanvas/page/internal';
import { evaluateTableView } from './table-view';
import type { ColumnCandidate, ColumnCandidatesPage } from './ports';

export function candidateView(view: TableQueryView, field: string): TableQueryView {
  return { ...structuredClone(view), predicates: view.predicates.filter(p => p.field !== field), sort: [], pageIndex: 0 };
}
export function candidateKey(value: string | number): string { return JSON.stringify([typeof value, value]); }
export function validateCandidatePage(page: ColumnCandidatesPage, offset: number, limit: number): ColumnCandidatesPage {
  if (page.kind === 'unavailable') return page;
  if (!Array.isArray(page.candidates) || page.candidates.some(c => !c || !['string', 'number'].includes(typeof c.value) || (typeof c.value === 'number' && !Number.isFinite(c.value)) || typeof c.label !== 'string')) {
    throw Object.assign(new Error('候选值字段契约不匹配'), { code: 'DQE_ROW_CONTRACT_ERROR' });
  }
  const keys = new Set(page.candidates.map(c => candidateKey(c.value)));
  if (!Number.isSafeInteger(page.totalCount) || page.totalCount < 0 || page.candidates.length > limit ||
      offset + page.candidates.length > page.totalCount || keys.size !== page.candidates.length ||
      page.candidates.length !== Math.min(limit, Math.max(0, page.totalCount - offset)) ||
      page.candidates.some(c => !['string', 'number'].includes(typeof c.value) || (typeof c.value === 'number' && !Number.isFinite(c.value)) || typeof c.label !== 'string')) {
    throw Object.assign(new Error('候选值分页缺少完整性证明'), { code: 'DQE_ROW_CONTRACT_ERROR' });
  }
  return page;
}
export function localColumnCandidates(rows: readonly Row[], field: string, view: TableQueryView, search: string, offset: number, limit: number): ColumnCandidatesPage {
  const values = new Map<string, ColumnCandidate>();
  for (const row of evaluateTableView(rows, candidateView(view, field), true).rows) {
    const value = row[field];
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    values.set(candidateKey(value), { value, label: String(value) });
  }
  const term = search.toLowerCase();
  const candidates = [...values.values()].filter(c => c.label.toLowerCase().includes(term))
    .sort((a, b) => canonicalizeJson(a.value).localeCompare(canonicalizeJson(b.value), 'en'));
  return { kind: 'values', candidates: candidates.slice(offset, offset + limit), totalCount: candidates.length };
}
