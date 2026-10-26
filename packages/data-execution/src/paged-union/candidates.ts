import { hasQueryFieldMapping, type Page } from '@metriccanvas/page/internal';
import type { ColumnCandidatesRead } from '../source-program/column-candidates';
import type { ColumnCandidate, ColumnCandidatesPage } from '../ports';
import type { QueryRunner } from '../query-runner';
import { candidateKey, candidateView } from '../column-candidates';
import { compileUnion, unionError, type UnionMemberPlan, type UnionPlan } from './plan';

export async function unionCandidates(page: Page, request: ColumnCandidatesRead, runner: QueryRunner, scope: string, inputSignal?: AbortSignal): Promise<ColumnCandidatesPage> {
  const signal = AbortSignal.any([...(inputSignal ? [inputSignal] : []), AbortSignal.timeout(60_000)]);
  const view = candidateView(request.view, request.field);
  const plan = compileUnion(page, request.sourceId, request.conditions, view, request.now);
  const values = new Map<string, ColumnCandidate>();
  for (const member of plan.members) {
    if (!await collectMemberCandidates(plan, member, request, values, runner, scope, signal)) return { kind: 'unavailable' };
    if (values.size > 10000) throw unionError('跨来源候选超过 10000 项，请缩小查询范围', 'DQE_QUERY_REJECTED');
  }
  const term = (request.candidateSearch ?? '').toLowerCase();
  const candidates = [...values.values()].filter(value => value.label.toLowerCase().includes(term)).sort((a, b) => candidateKey(a.value).localeCompare(candidateKey(b.value), 'en'));
  const offset = request.offset ?? 0, limit = request.pageSize ?? 50;
  return { kind: 'values', candidates: candidates.slice(offset, offset + limit), totalCount: candidates.length };
}
function addLiteral(values: Map<string, ColumnCandidate>, value: unknown): void {
  if (typeof value === 'string' || typeof value === 'number') values.set(candidateKey(value), { value, label: String(value) });
}
async function hasRows(plan: UnionPlan, member: UnionMemberPlan, runner: QueryRunner, scope: string, signal: AbortSignal): Promise<boolean> {
  const result = await runner.run({ ...member.query, pagination: { offset: 0, limit: 1 } }, { pageId: plan.page.id, dataSourceIds: [plan.id] }, scope, signal);
  if (result.status === 'error') throw unionError(result.error.message, result.error.code);
  return result.status === 'ready' && result.rows.length > 0;
}
async function memberCandidates(plan: UnionPlan, member: UnionMemberPlan, field: string, queryField: string, search: string, runner: QueryRunner, scope: string, signal: AbortSignal): Promise<ColumnCandidate[] | undefined> {
  const candidates: ColumnCandidate[] = [];
  let expected: number | undefined;
  while (true) {
    signal.throwIfAborted();
    const result = await runner.runCandidates({ query: { ...member.query, sort: undefined, pagination: undefined }, field, queryField, search, offset: candidates.length, limit: 200 }, { pageId: plan.page.id, dataSourceIds: [plan.id, member.member.source] }, scope, signal);
    if (result.kind === 'unavailable') return;
    if (result.totalCount > 10000) throw unionError('来源候选超过 10000 项', 'DQE_QUERY_REJECTED');
    if (expected !== undefined && expected !== result.totalCount) throw unionError('候选总数变化，请重试');
    expected = result.totalCount;
    candidates.push(...result.candidates);
    if (candidates.length === expected) return candidates;
  }
}

async function collectMemberCandidates(plan: UnionPlan, member: UnionMemberPlan, request: ColumnCandidatesRead, values: Map<string, ColumnCandidate>, runner: QueryRunner, scope: string, signal: AbortSignal): Promise<boolean> {
    const projection = member.member.projection[request.field];
    if (request.field === plan.data.source.sourceField) {
      if (await hasRows(plan, member, runner, scope, signal)) addLiteral(values, member.id);
    }
    else if (projection && 'value' in projection) {
      if (await hasRows(plan, member, runner, scope, signal)) addLiteral(values, projection.value);
    } else {
      if (!projection || !('field' in projection)) throw unionError('候选字段投影无效');
      const mapping = member.input.fields[projection.field];
      if (!hasQueryFieldMapping(mapping)) throw unionError('候选字段缺少查询映射');
      const complete = await memberCandidates(plan, member, projection.field, mapping.queryField, request.candidateSearch ?? '', runner, scope, signal);
      if (!complete) return false;
      for (const value of complete) values.set(candidateKey(value.value), value);
    }
  return true;
}
