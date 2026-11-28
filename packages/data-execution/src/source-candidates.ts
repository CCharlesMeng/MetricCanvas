import {
  canonicalizeJson,
  conditionSourceIds,
  type DataSnapshot,
  type DimensionFilterDeclaration,
  type DisplayInputsSnapshot,
  type Page,
  periodFact,
  type Row,
  selectQuery,
  sourceCandidateErrors,
} from '@metriccanvas/page/internal';
import { bindCandidateGateway, createCandidateRequestPool } from './candidate-session';
import { candidateDependencyIds, validFilterCandidates } from './filter-candidates';
import type { FilterValue, FilterValues } from './filter-values';
import { createNativeIocPreparation } from './native-ioc-preparation';
import type { FilterCandidate, FilterCandidatesRequest, RuntimeDataGateway } from './ports';
import { createSourceCandidateWindowReader } from './read-source-candidate-window';
import {
  type CompleteCandidateReason,
  inspectSourceCandidateWindow,
} from './source-candidate-window';
import { createCoreSourceProgram } from './source-program/core';
import { SourceRangeError } from './source-program/range-policy';

type Context = {
  displayInputs?: () => DisplayInputsSnapshot | undefined;
  filterRevision?: () => number;
  clock?: () => Date;
  now?: Date;
};
type FrozenContext = { displayInputs?: DisplayInputsSnapshot; filterRevision?: number; now: Date };

export interface SourceCandidateSession {
  gateway: RuntimeDataGateway;
  native: ReturnType<typeof createNativeIocPreparation>;
  capture(context: FrozenContext): { gateway: RuntimeDataGateway; signal: AbortSignal };
  invalidate(request: FilterCandidatesRequest): void;
  dispose(): void;
}

/** A page instance owns both its prepared sources and the candidate receipts derived from them. */
export function createSourceCandidateSession(
  input: Page,
  base: RuntimeDataGateway,
  context: Context = {},
): SourceCandidateSession {
  const native = createNativeIocPreparation(input, base);
  const page = native.page;
  const filters = new Map(
    page.filters?.flatMap((filter) =>
      filter.type === 'dimension' ? [[filter.id, filter] as const] : [],
    ),
  );
  const hasPageCandidates = [...filters.values()].some((filter) => filter.candidates);
  const validSources = !hasPageCandidates || sourceCandidateErrors(page).length === 0;
  let active = permissionScope(page, undefined);
  let disposed = false;

  const session: SourceCandidateSession = {
    native,
    gateway: gatewayWithContext(() => freezeContext(context)),
    capture(frozen) {
      const scope = scopeFor(frozen);
      return { gateway: gatewayWithContext(() => frozen, scope), signal: scope.controller.signal };
    },
    invalidate(request) {
      active.pool.invalidate(request);
      const sourceId = filters.get(request.filterId)?.candidates?.dataSource;
      if (sourceId) native.retry(sourceId, candidateConditions(page, request));
    },
    dispose() {
      disposed = true;
      endPermissionScope(active);
      native.dispose();
    },
  };
  return session;

  function gatewayWithContext(
    freeze: () => FrozenContext,
    capturedScope?: ReturnType<typeof permissionScope>,
  ): RuntimeDataGateway {
    if (!hasPageCandidates && !base.fetchFilterCandidates) return base;
    const gateway = bindCandidateGateway(base, async (request, { signal }) => {
      const frozen = freeze();
      const scope = capturedScope ?? scopeFor(frozen);
      scope.controller.signal.throwIfAborted();
      const copy = structuredClone(request);
      const filter = filters.get(copy.filterId);
      if (!filter?.candidates) {
        return scope.pool.read(
          copy,
          '',
          signal,
          (shared) =>
            base.fetchFilterCandidates?.(copy, { signal: shared }) ??
            Promise.resolve({ kind: 'unavailable' }),
        );
      }
      if (!validSources) fail('DQE_CONFIG_ERROR', '页面数据源候选声明无效');
      const conditions = candidateConditions(page, copy);
      const key = sourceReceiptScope(page, filter.candidates.dataSource, conditions, frozen);
      const plan = inspectSourceCandidateWindow(page, filter);
      if (copy.sourceRead) {
        if (plan.kind !== 'window') return { kind: 'unavailable' };
        const read = copy.sourceRead;
        return scope.pool.read(copy, key, signal, async (shared) => {
          await native.ensure(plan.sourceId, conditions, shared);
          return scope.readWindow(plan, filter.id, read, conditions, gateway, shared, frozen);
        });
      }
      const reason = plan.kind === 'complete' ? plan.reason : 'complete-candidate-read';
      return scope.pool.read(copy, key, signal, (shared) =>
        readCompleteCandidates(session, gateway, filter, reason, conditions, shared, frozen),
      );
    });
    return gateway;
  }

  function scopeFor(frozen: FrozenContext) {
    if (disposed) fail('DQE_CANCELLED', '候选会话已结束');
    const revision = frozen.displayInputs?.permissionRevision;
    if (active.revision !== revision) {
      endPermissionScope(active);
      native.reset();
      active = permissionScope(page, revision);
    }
    return active;
  }
}

function freezeContext(context: Context): FrozenContext {
  return {
    displayInputs: structuredClone(context.displayInputs?.()),
    filterRevision: context.filterRevision?.(),
    now: context.now ?? context.clock?.() ?? new Date(),
  };
}

function permissionScope(page: Page, revision: string | undefined) {
  return {
    revision,
    controller: new AbortController(),
    pool: createCandidateRequestPool(),
    readWindow: createSourceCandidateWindowReader(page),
  };
}

function endPermissionScope(scope: ReturnType<typeof permissionScope>) {
  scope.controller.abort();
  scope.pool.dispose();
}

/** Standalone candidate adapter. Runtime consumers with a lifecycle use the session directly. */
export function sourceCandidatesGateway(
  page: Page,
  base: RuntimeDataGateway,
  context: Context = {},
): RuntimeDataGateway {
  if (!page.filters?.some((filter) => filter.type === 'dimension' && filter.candidates))
    return base;
  return createSourceCandidateSession(page, base, context).gateway;
}

async function readCompleteCandidates(
  session: SourceCandidateSession,
  gateway: RuntimeDataGateway,
  filter: DimensionFilterDeclaration,
  reason: CompleteCandidateReason,
  conditions: FilterValues,
  signal: AbortSignal,
  context: FrozenContext,
) {
  const page = session.native.page;
  const sourceId = filter.candidates!.dataSource;
  const program = createCoreSourceProgram(page, {
    gateway,
    candidateSession: session,
    diagnostics: { sourceCandidates: { filterId: filter.id, kind: 'complete', reason } },
  });
  let snapshot: DataSnapshot | undefined;
  try {
    for await (const update of program.read({
      roots: [sourceId],
      conditions,
      purpose: 'complete',
      strictComplete: true,
      useInitial: false,
      signal,
      ...context,
    })) {
      if (update.sourceId === sourceId) snapshot = update.snapshot;
    }
    signal.throwIfAborted();
    return {
      kind: 'values' as const,
      candidates: projectSourceCandidates(
        filter,
        completeRows(snapshot, page.dataSources[sourceId]!.source.type === 'inline'),
      ),
    };
  } catch (cause) {
    if (cause instanceof SourceRangeError)
      fail(
        cause.code === 'EXPORT_ROW_LIMIT' ? 'DQE_QUERY_REJECTED' : 'DQE_ROW_CONTRACT_ERROR',
        '候选来源完整读取失败',
      );
    throw cause;
  } finally {
    program.dispose();
  }
}

function sourceReceiptScope(
  page: Page,
  sourceId: string,
  conditions: FilterValues,
  context: FrozenContext,
): string {
  const { now, displayInputs, filterRevision } = context;
  const factIds = new Set<string>();
  for (const id of conditions.keys()) {
    const filter = page.filters?.find((item) => item.id === id);
    if ((filter?.type === 'timePoint' || filter?.type === 'timeRange') && filter.availability)
      factIds.add(filter.availability.fact);
  }
  for (const id of conditionSourceIds(page, sourceId)) {
    const source = page.dataSources[id];
    if (source?.source.type !== 'query') continue;
    const query = selectQuery(source.source.query, conditions);
    for (const binding of Object.values(query.filterBindings ?? {})) {
      if (binding.target === 'time' && binding.periodComparison?.fact)
        factIds.add(binding.periodComparison.fact);
    }
  }
  const facts = [...factIds]
    .sort()
    .map((id) => [id, periodFact(displayInputs, id, filterRevision)]);
  const legacyRevision = usesLegacyCandidateDependency(page, conditions)
    ? (filterRevision ?? null)
    : null;
  return canonicalizeJson([
    displayInputs?.permissionRevision ?? null,
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    facts,
    legacyRevision,
  ]);
}
function usesLegacyCandidateDependency(page: Page, conditions: FilterValues): boolean {
  return (
    page.filters?.some((filter) => {
      if (
        filter.type !== 'dimension' ||
        filter.options ||
        filter.candidates ||
        filter.candidateContext ||
        filter.candidateWindow ||
        filter.treeSelection === 'level'
      )
        return false;
      const value = conditions.get(filter.id);
      return value?.type === 'dimension' && value.values.length > 0;
    }) ?? false
  );
}

function completeRows(snapshot: DataSnapshot | undefined, inline: boolean): Row[] {
  if (snapshot?.status === 'error')
    throw Object.assign(new Error(snapshot.error.message), snapshot.error);
  if (snapshot?.status === 'empty') return [];
  if (snapshot?.status !== 'ready' || (!inline && snapshot.totalCount !== snapshot.rows.length))
    fail('DQE_QUERY_REJECTED', '候选来源未返回完整结果');
  return snapshot.rows;
}
function candidateConditions(page: Page, request: FilterCandidatesRequest): FilterValues {
  const values = new Map<string, FilterValue>();
  const declarations = page.filters ?? [];
  const target = declarations.find((filter) => filter.id === request.filterId);
  if (target?.type !== 'dimension') return values;
  const dependencies = candidateDependencyIds(target, declarations);
  for (const filter of declarations) {
    if (!dependencies.has(filter.id)) continue;
    const selection =
      request.sourceValues?.[filter.id] ?? constraintSelection(filter, request.constraints);
    if (selection) values.set(filter.id, selection);
  }
  return values;
}

function constraintSelection(
  filter: NonNullable<Page['filters']>[number],
  constraints: FilterCandidatesRequest['constraints'],
): FilterValue | undefined {
  switch (filter.type) {
    case 'dimension': {
      const values = constraints.dimensions[filter.dimension];
      if (values) return { type: 'dimension', dimension: filter.dimension, values: [...values] };
      break;
    }
    case 'timePoint': {
      const range = constraints.times[filter.id];
      if (range) return { type: 'timePoint', granularity: filter.granularity, value: range.from };
      break;
    }
    case 'timeRange': {
      const range = constraints.times[filter.id];
      if (range) return { type: 'timeRange', ...range };
      break;
    }
    case 'boolean': {
      const value = constraints.booleans?.[filter.id];
      if (value !== undefined) return { type: 'boolean', value };
      break;
    }
  }
}

/** Deduplicate only after the complete read; conflicting identities never pick an arbitrary label/parent. */
export function projectSourceCandidates(
  filter: DimensionFilterDeclaration,
  rows: readonly Row[],
): FilterCandidate[] {
  if (filter.candidates?.levelField) return projectHierarchyCandidates(filter, rows);
  const spec = filter.candidates!,
    byValue = new Map<string, FilterCandidate>();
  for (const row of rows) {
    const value = scalar(row[spec.valueField]);
    if (value === undefined) continue;
    const label = spec.labelField ? (scalar(row[spec.labelField]) ?? value) : value;
    const parent = spec.parentField ? scalar(row[spec.parentField]) : undefined;
    const candidate = { value, label, ...(parent !== undefined ? { parentValue: parent } : {}) };
    const previous = byValue.get(value);
    if (previous && canonicalizeJson(previous) !== canonicalizeJson(candidate))
      fail('DQE_ROW_CONTRACT_ERROR', '候选稳定值对应的显示名或父节点不一致');
    byValue.set(value, candidate);
  }
  const candidates = [...byValue.values()];
  if (candidates.length > 10000) fail('DQE_QUERY_REJECTED', '候选值超过完整结果预算');
  validateParents(byValue);
  return candidates;
}

function projectHierarchyCandidates(
  filter: DimensionFilterDeclaration,
  rows: readonly Row[],
): FilterCandidate[] {
  const levels = filter.hierarchy!.map((level) => level.id);
  const byIdentity = new Map<string, FilterCandidate>();
  for (const row of rows) {
    const candidate = hierarchyCandidate(filter.candidates!, levels, row);
    if (!candidate) continue;
    const key = JSON.stringify([candidate.level, candidate.value]);
    const previous = byIdentity.get(key);
    if (previous && canonicalizeJson(previous) !== canonicalizeJson(candidate)) {
      fail('DQE_ROW_CONTRACT_ERROR', '候选层级及稳定值对应的显示名或父节点不一致');
    }
    byIdentity.set(key, candidate);
  }
  const candidates = [...byIdentity.values()];
  if (candidates.length > 10000) fail('DQE_QUERY_REJECTED', '候选值超过完整结果预算');
  if (!validFilterCandidates(candidates, levels))
    fail('DQE_ROW_CONTRACT_ERROR', '候选父节点不在声明的上一层');
  return candidates;
}

function hierarchyCandidate(
  spec: NonNullable<DimensionFilterDeclaration['candidates']>,
  levels: readonly string[],
  row: Row,
): FilterCandidate | undefined {
  const level = row[spec.levelField!];
  const index = typeof level === 'string' ? levels.indexOf(level) : -1;
  if (index < 0) fail('DQE_ROW_CONTRACT_ERROR', '候选行必须包含已声明的层级 ID');
  const value = scalar(row[spec.valueField]);
  if (value === undefined) return;
  const label = spec.labelField ? (scalar(row[spec.labelField]) ?? value) : value;
  const parentValue = scalar(row[spec.parentField!]);
  if (index === 0) {
    if (parentValue !== undefined) fail('DQE_ROW_CONTRACT_ERROR', '根层的候选节点不能声明父节点');
    return { level: levels[0]!, value, label };
  }
  if (parentValue === undefined) fail('DQE_ROW_CONTRACT_ERROR', '非根层的候选节点必须声明父节点');
  return {
    level: levels[index]!,
    value,
    label,
    parent: { level: levels[index - 1]!, value: parentValue },
  };
}

function scalar(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return;
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return String(value);
  fail('DQE_ROW_CONTRACT_ERROR', '候选输出必须是有限标量');
}
function validateParents(nodes: ReadonlyMap<string, FilterCandidate>): void {
  const complete = new Set<string>();
  for (const node of nodes.values()) {
    const seen = new Set<string>();
    let current: FilterCandidate | undefined = node;
    while (current && !complete.has(current.value)) {
      if (seen.has(current.value)) fail('DQE_ROW_CONTRACT_ERROR', '候选父子关系存在循环');
      seen.add(current.value);
      const parent: string | undefined = current.parentValue;
      if (parent !== undefined && !nodes.has(parent))
        fail('DQE_ROW_CONTRACT_ERROR', '候选父节点不在完整结果中');
      current = parent === undefined ? undefined : nodes.get(parent);
    }
    for (const value of seen) complete.add(value);
  }
}
function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}
