import {
  canonicalizeJson,
  cascadeSourceIds,
  conditionSourceIds,
  type DataSnapshot,
  type DataSource,
  type DisplayInputsSnapshot,
  type EffectiveQuery,
  finalizationName,
  flattenPageComponents,
  hasHeaderDefaults,
  hasPeriodQueryDefault,
  IOC_KEY_OFFICE_FILTER_IDS,
  IOC_REGION_FILTER_ID,
  isPagedJoinQuery,
  isUnrestrictedIocRegion,
  normalizeTableSelectView,
  overriddenFilterIds,
  type Page,
  type PagedJoinDataSource,
  type QueryDataSource,
  reconcilePagedJoinView,
  requiresQueryContext,
  requiresTimeValidation,
  sourceFilterIds,
  type TableComponent,
  type TableQueryView,
  type TabSelections,
  tableDefaultsRemote,
  tableHeaders,
} from '@metriccanvas/page/internal';
import { withAbortSignals } from '../abort-signals';
import { createCandidateValidator } from '../candidate-validation';
import { debugWarn } from '../debug-warnings';
import { bindQueryResultValues, composeEffectiveQuery } from '../effective-query';
import {
  applyConditionalDimensionDefaults,
  type FilterValue,
  type FilterValues,
  initialFilterValues,
} from '../filter-values';
import { intersectQueryFilters } from '../intersect-filters';
import { compilePagedJoin } from '../paged-join/plan';
import { clearRecordJoinCache } from '../paged-join/records-reader';
import { createUnionReader } from '../paged-union/execute';
import { preservedQueryError } from '../query-error';
import { presentationQuerySources } from '../query-projection';
import { resolveQueryResultInputs } from '../query-result-inputs';
import { createQueryRunner } from '../query-runner';
import { rawSnapshot } from '../snapshots';
import { type ColumnCandidatesRead, createColumnCandidatesReader } from './column-candidates';
import { activeSourceIds, compileSources, executionSourceIds, visibleSourceIds } from './compiler';
import {
  checkOrdinaryRange,
  reportInitialSnapshotWarnings,
  reusableInitialSnapshot,
} from './range-policy';
import { defaultSourceView, readSourceProgram } from './read';
import { createTableSlotSearchReader, mainTableSearch } from './slot-search';
import { automaticQueryPageSize } from './table-pagination';
import type {
  CoreSourceProgramConfig,
  ProgramState,
  SourceProgramConfig,
  SourceRead,
  SourceUpdate,
} from './types';

export {
  type CoreSourceProgramConfig,
  defaultSourceView,
  type ProgramState,
  type SourceProgramConfig,
  type SourceRead,
  type SourceUpdate,
};

function requiresFreshTime(
  filter: NonNullable<Page['filters']>[number] | undefined,
  reuse: boolean,
): boolean {
  return (
    !!reuse &&
    !!filter &&
    (filter.type === 'timeRange' || filter.type === 'timePoint') &&
    requiresTimeValidation(filter)
  );
}

function dynamicPeriodDefault(filter: NonNullable<Page['filters']>[number] | undefined): boolean {
  if (filter && finalizationName(filter)) return true;
  return (
    filter?.type === 'timeRange' &&
    filter.display === 'period' &&
    !!filter.default &&
    typeof filter.default === 'object' &&
    'mode' in filter.default &&
    (filter.default.mode === 'last12Months' ||
      !('value' in filter.default) ||
      !filter.default.value)
  );
}

function buildDefaultFilterValues(
  page: Page,
  config: CoreSourceProgramConfig,
): Map<string, FilterValue> {
  const defaults = new Map<string, FilterValue>();
  const defaultNow = config.now ?? config.clock?.() ?? new Date();
  const defaultInputs = config.displayInputs?.();
  const defaultRevision = config.filterRevision?.();
  for (const filter of page.filters ?? []) {
    try {
      for (const [id, value] of initialFilterValues(
        [filter],
        defaultNow,
        defaultInputs,
        defaultRevision,
      )) {
        defaults.set(id, value);
      }
    } catch (cause) {
      /* An unavailable dynamic default cannot override an explicit valid selection. */
      debugWarn('[MetricCanvas][SOURCE_PROGRAM] 跳过暂不可用的动态筛选默认值', {
        filterId: filter.id,
        cause,
      });
    }
  }
  applyConditionalDimensionDefaults(page.filters ?? [], defaults);
  return defaults;
}

function isOverridesSource(state: ProgramState, id: string, values: FilterValues): boolean {
  if (state.native.active(id, values)) return true;
  const overridden = overriddenFilterIds(state.page.filters ?? [], values);
  // Authorized membership may change independently of the page's declared defaults.
  for (const key of IOC_KEY_OFFICE_FILTER_IDS) {
    const value = values.get(key);
    if (value?.type === 'boolean' && value.value === true) overridden.add(key);
  }
  if (isUnrestrictedIocRegion(state.page, IOC_REGION_FILTER_ID, values.get(IOC_REGION_FILTER_ID))) {
    overridden.add(IOC_REGION_FILTER_ID);
  }
  return [...conditionSourceIds(state.page, id)].some(
    (key) =>
      state.defaultPeriodSources.has(key) ||
      sourceFilterIds(state.page.dataSources[key]).some((filterId) => overridden.has(filterId)),
  );
}

function hasDefaultConditions(
  state: ProgramState,
  id: string,
  values: FilterValues,
  reuse = true,
): boolean {
  if (reuse && (state.unsafeInitials.has(id) || state.overridesSource(id, values))) return false;
  const dependencyIds = [...conditionSourceIds(state.page, id)];
  if (
    reuse &&
    dependencyIds.some((key) => {
      const source = state.page.dataSources[key];
      return (
        source?.source.type === 'query' &&
        requiresQueryContext(source.source.query, state.page.filters)
      );
    })
  ) {
    return false;
  }
  const filters = new Set(
    dependencyIds.flatMap((key) => sourceFilterIds(state.page.dataSources[key])),
  );
  return [...filters].every((filterId) => {
    const filter = state.page.filters?.find((item) => item.id === filterId);
    if (requiresFreshTime(filter, reuse) || dynamicPeriodDefault(filter)) return false;
    return (
      canonicalizeJson(values.get(filterId) ?? null) ===
      canonicalizeJson(state.defaults.get(filterId) ?? null)
    );
  });
}

function resolveSourceReadScope(
  state: ProgramState,
  freshness: SourceRead['freshness'],
  inputs: DisplayInputsSnapshot | undefined,
): string {
  const nextScope = inputs ? `context:${canonicalizeJson(inputs)}` : 'session';
  if (nextScope !== state.contextScope) {
    state.runner.forgetScope(state.contextScope);
    state.union.clear();
    state.slotSearch.clear();
    clearRecordJoinCache(state.runner);
    state.contextScope = nextScope;
  }
  if (freshness === 'refresh') {
    state.union.clear();
    state.slotSearch.clear();
    clearRecordJoinCache(state.runner);
  }
  return freshness === 'refresh' ? `fresh:${++state.batch}` : nextScope;
}

function initialIntersection(
  state: ProgramState,
  source: DataSource,
  conditions: FilterValues,
): DataSnapshot | undefined {
  if (
    source.source.type !== 'query' ||
    requiresQueryContext(source.source.query, state.page.filters)
  ) {
    return;
  }
  const query = composeEffectiveQuery(
    {
      displayInputs: state.config.displayInputs?.(),
      filterRevision: state.config.filterRevision?.(),
      now: state.config.now ?? state.config.clock?.() ?? new Date(),
      page: state.page,
      filters: state.page.filters,
      dataSource: source as QueryDataSource,
    },
    conditions,
    0,
    [],
    {},
  );
  if (!intersectQueryFilters(query)) return { status: 'empty', totalCount: 0 };
}

function initialSourceSnapshot(
  state: ProgramState,
  id: string,
  source: DataSource,
  view: TableQueryView,
  conditions: FilterValues,
): DataSnapshot {
  if (state.native.waiting(id, conditions)) return { status: 'loading' };
  try {
    const trusted = state.candidates.trusted(id, conditions);
    const terminal = trusted ? initialIntersection(state, source, conditions) : undefined;
    if (terminal) return terminal;
    const initial =
      trusted && state.defaultConditions(id, conditions)
        ? reusableInitialSnapshot(source, view, state.compiled.limits.has(id))
        : source.source.type === 'inline'
          ? rawSnapshot(source.source.rows)
          : undefined;
    const diagnostics = { ...state.config.diagnostics, pageId: state.page.id, dataSourceIds: [id] };
    reportInitialSnapshotWarnings(source, initial, diagnostics);
    return initial
      ? checkOrdinaryRange(source, initial, undefined, diagnostics)
      : { status: 'loading' };
  } catch (cause) {
    return { status: 'error', error: preservedQueryError(cause) };
  }
}

function captureSourceQuery(
  state: ProgramState,
  id: string,
  source: QueryDataSource,
  capture: {
    conditions: FilterValues;
    views: ReadonlyMap<string, TableQueryView>;
    raw: ReadonlyMap<string, DataSnapshot>;
    sources: ReadonlyMap<string, DataSource>;
    limits: ReadonlyMap<string, number>;
    now: Date;
  },
): EffectiveQuery | undefined {
  try {
    const { conditions, views, raw, sources, limits, now } = capture;
    const view = views.get(id) ?? defaultSourceView(state.page, id);
    const query = composeEffectiveQuery(
      {
        displayInputs: state.config.displayInputs?.(),
        filterRevision: state.config.filterRevision?.(),
        now,
        page: state.page,
        filters: state.page.filters,
        dataSource: source,
        ...(limits.has(id) ? { pagination: { limit: view.pageSize } } : {}),
      },
      conditions,
      state.cascaded.has(id) ? view.pageIndex : 0,
      view.sort,
      tableHeaders(view.predicates),
      mainTableSearch(view.search),
    );
    const inputs = resolveQueryResultInputs(source, raw, sources, limits);
    if (inputs.status === 'ready') bindQueryResultValues(query, inputs.values);
    return structuredClone(query);
  } catch (cause) {
    // read owns rejected-source diagnostics; an invalid query cannot be captured.
    debugWarn('[MetricCanvas][SOURCE_PROGRAM] 无法捕获数据源查询定义', { sourceId: id, cause });
    return undefined;
  }
}

function captureCurrentCandidates(state: ProgramState) {
  return state.candidateSession.capture({
    now: state.config.now ?? state.config.clock?.() ?? new Date(),
    displayInputs: structuredClone(state.config.displayInputs?.()),
    filterRevision: state.config.filterRevision?.(),
  });
}

function initializeProgramState(config: CoreSourceProgramConfig): ProgramState {
  const candidateSession = config.candidateSession;
  const native = candidateSession.native;
  const effectivePage = native.page;
  const effectiveConfig: CoreSourceProgramConfig = { ...config, gateway: candidateSession.gateway };
  const compiled = compileSources(effectivePage);
  for (const id of compiled.automatic) {
    const source = compiled.sources.get(id)!;
    if (source.source.type === 'query') {
      const size = automaticQueryPageSize(
        source as QueryDataSource,
        reusableInitialSnapshot(source),
      );
      if (size) compiled.limits.set(id, size);
    }
  }
  const runner = createQueryRunner(effectiveConfig);
  const union = createUnionReader(runner);
  const slotSearch = createTableSlotSearchReader();
  const candidates = createCandidateValidator(
    effectivePage,
    effectiveConfig.gateway,
    effectiveConfig,
  );
  const defaultPeriodSources = new Set(
    [...compiled.sources]
      .filter(
        ([, source]) =>
          source.source.type === 'query' &&
          hasPeriodQueryDefault(source.source.query, effectivePage),
      )
      .map(([id]) => id),
  );
  const headerTables = flattenPageComponents(effectivePage).filter(
    (node): node is TableComponent => node.type === 'table',
  );
  const unsafeInitials = new Set(
    headerTables
      .filter(
        (table) =>
          hasHeaderDefaults(table.props.columns) &&
          tableDefaultsRemote(effectivePage, table) &&
          effectivePage.dataSources[table.data.main]?.source.type === 'query',
      )
      .map((table) => table.data.main),
  );
  const state: ProgramState = {
    page: effectivePage,
    config: effectiveConfig,
    candidateSession,
    native,
    compiled,
    runner,
    union,
    slotSearch,
    candidates,
    cascaded: cascadeSourceIds(effectivePage.dataSources),
    defaultPeriodSources,
    headerTables,
    unsafeInitials,
    defaults: buildDefaultFilterValues(effectivePage, effectiveConfig),
    batch: 0,
    contextScope: 'session',
    defaultConditions: (id, values, reuse = true) => hasDefaultConditions(state, id, values, reuse),
    overridesSource: (id, values) => isOverridesSource(state, id, values),
    sourceReadScope: (freshness, inputs) => resolveSourceReadScope(state, freshness, inputs),
  };
  return state;
}

function prepareProgramView(
  state: ProgramState,
  id: string,
  conditions: FilterValues,
  view: TableQueryView,
  field?: string,
  previous?: TableQueryView,
): TableQueryView {
  const source = state.page.dataSources[id];
  const table = state.headerTables.find((item) => item.data.main === id);
  const normalized = table
    ? normalizeTableSelectView(state.page, id, table.props.columns, view)
    : view;
  if (source?.source.type !== 'pagedJoin' || !isPagedJoinQuery(source.source)) return normalized;
  return compilePagedJoin(
    state.page,
    id,
    conditions,
    reconcilePagedJoinView(source as PagedJoinDataSource, normalized, field, previous),
    state.config.now ?? state.config.clock?.(),
    {
      displayInputs: state.config.displayInputs?.(),
      filterRevision: state.config.filterRevision?.(),
    },
  ).view;
}

function programInitialSnapshots(
  state: ProgramState,
  request: Pick<SourceRead, 'roots' | 'conditions' | 'views' | 'selections'>,
): Map<string, DataSnapshot> {
  captureCurrentCandidates(state);
  const snapshots = new Map<string, DataSnapshot>();
  const sources = presentationQuerySources(
    state.page,
    {
      declarations: state.page.filters ?? [],
      filters: request.conditions,
      displaySnapshot: state.config.displayInputs?.(),
      filterRevision: state.config.filterRevision?.(),
    },
    request,
  );
  for (const id of executionSourceIds(state.page, request.roots, sources)) {
    const source = sources.get(id);
    if (!source) continue;
    const view =
      request.views?.get(id) ?? defaultSourceView(state.page, id, state.compiled.limits.get(id));
    snapshots.set(id, initialSourceSnapshot(state, id, source, view, request.conditions));
  }
  return snapshots;
}

function programCaptureQueries(
  state: ProgramState,
  conditions: FilterValues,
  views: ReadonlyMap<string, TableQueryView>,
  raw: ReadonlyMap<string, DataSnapshot>,
  selections?: TabSelections,
): ReadonlyMap<string, EffectiveQuery> {
  captureCurrentCandidates(state);
  const queries = new Map<string, EffectiveQuery>();
  const now = state.config.now ?? state.config.clock?.() ?? new Date();
  const limits = new Map(state.compiled.limits);
  const context = {
    declarations: state.page.filters ?? [],
    filters: conditions,
    displaySnapshot: state.config.displayInputs?.(),
    filterRevision: state.config.filterRevision?.(),
  };
  const sources = presentationQuerySources(state.page, context, { views, selections });
  const roots = selections
    ? activeSourceIds(state.page, selections, context, views)
    : visibleSourceIds(state.page, context, views);
  for (const [id, view] of views) if (state.compiled.limits.has(id)) limits.set(id, view.pageSize);
  for (const id of roots) {
    if (state.native.waiting(id, conditions)) continue;
    const source = sources.get(id)!;
    if (source.source.type !== 'query') continue;
    const query = captureSourceQuery(state, id, source as QueryDataSource, {
      conditions,
      views,
      raw,
      sources,
      limits,
      now,
    });
    if (query) queries.set(id, query);
  }
  return queries;
}

/** All execution policies are owned here; adapters own publication and lifecycle. */
export function createCoreSourceProgram(_page: Page, config: CoreSourceProgramConfig) {
  const state = initializeProgramState(config);
  const ownsCandidateSession = config.ownsCandidateSession === true;
  const program = {
    prepareView(
      id: string,
      conditions: FilterValues,
      view: TableQueryView,
      field?: string,
      previous?: TableQueryView,
    ): TableQueryView {
      return prepareProgramView(state, id, conditions, view, field, previous);
    },
    async readColumnCandidates(request: ColumnCandidatesRead) {
      const { signal: permissionSignal } = captureCurrentCandidates(state);
      return withAbortSignals([request.signal, permissionSignal], async (signal) => {
        const preparation = state.native.ensure(request.sourceId, request.conditions, signal);
        if (preparation) await preparation;
        return createColumnCandidatesReader(
          state.page,
          state.runner,
          (value) => program.read(value),
          state.compiled.limits,
          { ...state.config, slotSearch: state.slotSearch },
        )({ ...request, signal });
      });
    },
    preparing(sourceId: string, conditions: FilterValues) {
      return state.native.waiting(sourceId, conditions);
    },
    prepareInputs(sourceId: string, conditions: FilterValues) {
      return (
        state.native.ensure(sourceId, conditions, captureCurrentCandidates(state).signal) ??
        Promise.resolve()
      );
    },
    retryPreparation(sourceId: string, conditions: FilterValues) {
      state.native.retry(sourceId, conditions);
    },
    initialSnapshots(request: Pick<SourceRead, 'roots' | 'conditions' | 'views' | 'selections'>) {
      return programInitialSnapshots(state, request);
    },
    captureQueries(
      conditions: FilterValues,
      views: ReadonlyMap<string, TableQueryView>,
      raw: ReadonlyMap<string, DataSnapshot>,
      selections?: TabSelections,
    ) {
      return programCaptureQueries(state, conditions, views, raw, selections);
    },
    read(input: SourceRead): AsyncGenerator<SourceUpdate> {
      return readSourceProgram(state, input);
    },
    dispose() {
      if (ownsCandidateSession) state.candidateSession.dispose();
      state.union.clear();
      state.slotSearch.clear();
      clearRecordJoinCache(state.runner);
      state.runner.dispose();
    },
  };
  return program;
}

export type SourceProgram = ReturnType<typeof createCoreSourceProgram>;
