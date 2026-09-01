<script lang="ts">
  import {
    dataSourceMode,
    derivePageCapabilities,
    fieldName,
    isChartComponent,
    parsePage,
    pageListEntry,
    resolveDataSourceFields,
    flattenPageComponents,
    type ChartComponent,
    type Component,
    type ComponentCapabilities,
    type DataSnapshot,
    type FilterDeclaration,
    type Page,
    type PageParamDeclaration,
    type Row,
    type TableColumn,
    type TableComponent,
    type TextLink,
    type NumberRangeValue,
    type TimeRangeValue,
    type TypedError
  } from '@metriccanvas/page';
  import {
    createDimensionValuesLoader,
    createFilterState,
    drillThroughSearch,
    initialFilterValues,
    orchestrate,
    resolvePageParams,
    type DimensionValuesSnapshots,
    type FilterState,
    type FilterValue,
    type FilterValues,
    type PageDataSnapshots,
    type PageSnapshotStream,
    type RuntimeDataGateway
  } from '@metriccanvas/runtime';
  import {
    buildTableColumnLayout,
    formatValue,
    initialTableSort,
    shouldApplyTableHeaderFilter,
    type NamedDataSlots,
    type TableHeaderFilterValue,
    type TablePaginationState,
    type TableSelectedCell,
    type TableViewState
  } from '@metriccanvas/widgets';
  import ComponentRenderer from './ComponentRenderer.svelte';
  import type { NestedComponentRender, TableRenderBinding } from './component-render';
  import {
    filterMapRows,
    isHierarchyDeclaration,
    resolveMapBasemap,
    resolveMapClick
  } from './map-hierarchy';
  import { collectDataErrors } from './data-error-events';
  import FilterBar from './filters/FilterBar.svelte';
  import DashboardToolbar from './dashboard/DashboardToolbar.svelte';
  import { dashboardFilterGroups } from './dashboard/filter-groups';
  import {
    cascadeConstraints,
    clearDependentUpdates,
    dimensionValueOf
  } from './filters/cascade';
  import { hasVisibleFilters } from './filters/filter-bar';
  import { applySearchFilters } from './filters/inline-search';
  import { hostRenderSnapshot, renderableDataSnapshot } from './widget-host-state';
  import RuntimeSection from './RuntimeSection.svelte';
  import { resolveAuthoringSections } from './authoring-layout';
  import type { AiSummaryConfig } from './ai-summary/pangu-sse';
  import {
    configurationError,
    isDataGateway,
    type AuthoringOptions,
    type RuntimeConfigurationError,
    type RuntimeNavigation,
    type RuntimeViewEvent
  } from './types';

  type PageCapabilities = ReturnType<typeof derivePageCapabilities>;
  type ComponentSnapshots = ReadonlyMap<string, DataSnapshot>;
  type PageState =
    | { phase: 'loading' }
    | { phase: 'invalid'; errors: TypedError[] }
    | { phase: 'configuration-error'; error: RuntimeConfigurationError }
    /** 必需页面参数缺失:页面输入不完整,与查询错误分类区分开(ADR-0047)。 */
    | { phase: 'params-incomplete'; missing: PageParamDeclaration[] }
    | { phase: 'ready'; page: Page; capabilities: PageCapabilities };

  // inline 页面不访问数据网关;候选值能力缺席即不可用,不需要抛错桩。
  const inlineGateway: RuntimeDataGateway = {
    async fetchData() {
      throw new Error('inline 页面不应访问数据网关');
    }
  };

  let {
    document,
    authoring,
    dataGateway,
    aiSummary,
    initialSearch = '',
    navigation,
    onevent,
    pageRevisionId
  }: {
    document: unknown;
    authoring?: AuthoringOptions;
    dataGateway?: RuntimeDataGateway;
    aiSummary?: AiSummaryConfig;
    initialSearch?: string;
    navigation?: RuntimeNavigation;
    onevent?: (event: RuntimeViewEvent) => void;
    /** 精确修订预览时的页面修订标识,只用于查询诊断定位,不影响渲染。 */
    pageRevisionId?: string;
  } = $props();

  let pageState = $state<PageState>({ phase: 'loading' });
  let snapshots = $state<PageDataSnapshots>(new Map());
  let filterValues = $state<FilterValues>(new Map());
  /** 筛选候选值快照(维度名 → 显式状态):筛选控件与表头筛选共用。 */
  let dimensionCandidates = $state<DimensionValuesSnapshots>(new Map());
  let tableViews = $state<Record<string, TableViewState>>({});
  let tablePageSizes = $state<Record<string, number>>({});
  let appliedTableHeaderFilters = $state<
    Record<string, Record<string, TableHeaderFilterValue>>
  >({});
  let activeGateway: RuntimeDataGateway = inlineGateway;

  let declarations = $state<FilterDeclaration[]>([]);
  let filterState: FilterState | null = null;
  let candidatesLoader: ReturnType<typeof createDimensionValuesLoader> | null = null;
  let stream: PageSnapshotStream | null = null;
  let session = 0;
  let disposers: Array<() => void> = [];

  const renderedSections = $derived.by(() =>
    pageState.phase === 'ready'
      ? resolveAuthoringSections(pageState.page.sections, authoring?.draftSections)
      : []
  );

  $effect(() => {
    void run(document, dataGateway, initialSearch, navigation, onevent, pageRevisionId);
    return dispose;
  });

  function dispose() {
    session += 1;
    for (const fn of disposers) fn();
    disposers = [];
    filterState = null;
    stream = null;
  }

  async function run(
    raw: unknown,
    gatewayOverride: RuntimeDataGateway | undefined,
    search: string,
    navigationAdapter: RuntimeNavigation | undefined,
    emit: ((event: RuntimeViewEvent) => void) | undefined,
    revisionId: string | undefined
  ) {
    const mySession = ++session;
    pageState = { phase: 'loading' };
    snapshots = new Map();
    filterValues = new Map();
    dimensionCandidates = new Map();
    tableViews = {};
    tablePageSizes = {};
    appliedTableHeaderFilters = {};

    // 保持异步初始化接缝，避免外层 effect 把初始化中的状态读取纳入依赖。
    await Promise.resolve();
    if (session !== mySession) return;

    // 页面参数不可变:先按声明解析一次 URL 输入,再用它们把文本取值引用
    // 整值替换掉。首次解析只为读到 params 声明,替换后的文档才是渲染依据。
    const declared = parsePage(raw);
    if (!declared.ok) {
      pageState = { phase: 'invalid', errors: declared.errors };
      emit?.({ type: 'invalid', errors: declared.errors });
      return;
    }
    const paramDeclarations = declared.page.params ?? [];
    const params = resolvePageParams(search, paramDeclarations);
    if (params.missing.length > 0) {
      pageState = {
        phase: 'params-incomplete',
        missing: paramDeclarations.filter((declaration) =>
          params.missing.includes(declaration.id)
        )
      };
      return;
    }
    const parsed =
      paramDeclarations.length === 0
        ? declared
        : parsePage(raw, { textValues: { values: params.values, format: formatValue } });
    if (!parsed.ok) {
      pageState = { phase: 'invalid', errors: parsed.errors };
      emit?.({ type: 'invalid', errors: parsed.errors });
      return;
    }

    const loaded = parsed.page;
    const mode = dataSourceMode(loaded.dataSources);
    const configIssue = configurationIssue(mode, gatewayOverride);
    if (configIssue) {
      pageState = { phase: 'configuration-error', error: configIssue };
      emit?.({ type: 'configuration-error', ...configIssue });
      return;
    }

    activeGateway = gatewayOverride ?? inlineGateway;

    const capabilities = derivePageCapabilities(loaded);
    declarations = loaded.filters ?? [];

    const fromDeclarations = initialFilterValues(declarations);
    const fromURL: FilterValues = capabilities.filters
      ? parseFilterURL(search, declarations)
      : new Map();
    const state = createFilterState(new Map([...fromDeclarations, ...fromURL]));
    filterState = state;

    let primed = false;
    disposers.push(
      state.subscribe((values) => {
        const previous = filterValues;
        filterValues = values;
        if (primed && capabilities.filters) {
          const nextSearch = mergedSearch(state, search);
          navigationAdapter?.replaceSearch(nextSearch);
          emit?.({ type: 'filter-change', search: nextSearch });
          resetTablePages(loaded, previous, values);
        }
        primed = true;
      })
    );

    const initialViews: Record<string, TableViewState> = {};
    for (const component of pageComponents(loaded)) {
      if (component.type !== 'table') continue;
      const source = loaded.dataSources[component.data.main];
      initialViews[component.id] = {
        pageIndex: 0,
        sort: initialTableSort(undefined),
        headerFilters: {}
      };
    }
    tableViews = initialViews;
    pageState = { phase: 'ready', page: loaded, capabilities };

    const pageStream = orchestrate(
      loaded,
      activeGateway,
      capabilities.filters ? state : undefined,
      revisionId !== undefined ? { pageRevisionId: revisionId } : undefined
    );
    stream = pageStream;
    const emittedDataErrors = new Map<string, string>();
    disposers.push(
      pageStream.subscribe((next) => {
        snapshots = next;
        syncQueryTablePages(loaded, next);
        // 结构化查询错误上抛为嵌入事件,宿主按分类决定重试或重登(issue #51)。
        for (const event of collectDataErrors(emittedDataErrors, next)) {
          emit?.(event);
        }
      })
    );
    emit?.({ type: 'ready', pageId: loaded.id });

    if (!capabilities.filters) return;

    // 筛选候选值:显式状态经加载器发布,dispose 时取消在途请求,
    // 过期结果不会覆盖新会话的筛选状态(issue #54)。
    candidatesLoader = createDimensionValuesLoader(activeGateway);
    const loader = candidatesLoader;
    disposers.push(() => {
      loader.dispose();
      if (candidatesLoader === loader) candidatesLoader = null;
    });
    disposers.push(
      loader.subscribe((next) => {
        if (session !== mySession) return;
        dimensionCandidates = next;
      })
    );

    for (const declaration of declarations) {
      if (declaration.type !== 'dimension') continue;
      loadDimensionCandidates(loader, declaration, filterValues);
    }

    const filterableFields = new Set<string>();
    for (const component of pageComponents(loaded)) {
      if (component.type !== 'table' || !capabilities.components[component.id]?.live) {
        continue;
      }
      if (component.props.pagination?.mode === 'query') continue;
      const source = loaded.dataSources[component.data.main];
      for (const column of buildTableColumnLayout(
        component.props.columns,
        source ? resolveDataSourceFields(source) : undefined
      ).leaves) {
        if (column.filterable?.mode === 'select') {
          filterableFields.add(fieldName(column.field));
        }
      }
    }
    for (const field of filterableFields) {
      candidatesLoader.load(field);
    }
  }

  function configurationIssue(
    mode: ReturnType<typeof dataSourceMode>,
    gatewayValue: unknown
  ): RuntimeConfigurationError | null {
    if (gatewayValue !== undefined && !isDataGateway(gatewayValue)) {
      return configurationError(
        'DATA_GATEWAY_INVALID',
        '数据网关必须实现 fetchData;候选值端口 fetchDimensionValues 可选,声明了必须是函数。'
      );
    }
    if (mode === 'inline') return null;
    if (gatewayValue === undefined) {
      return configurationError(
        'DATA_GATEWAY_REQUIRED',
        `${mode} 页面必须提供数据网关。`
      );
    }
    return null;
  }

  function pageComponents(loaded: Page): Component[] {
    return flattenPageComponents(loaded);
  }

  function componentCapability(component: Component): ComponentCapabilities | undefined {
    return pageState.phase === 'ready'
      ? pageState.capabilities.components[component.id]
      : undefined;
  }

  function setTableView(component: TableComponent, next: TableViewState) {
    tableViews = { ...tableViews, [component.id]: next };
  }

  function appliedHeaderFiltersOf(
    component: TableComponent
  ): Record<string, TableHeaderFilterValue> {
    return appliedTableHeaderFilters[component.id] ?? {};
  }

  function pushTableView(component: TableComponent, next: TableViewState) {
    setTableView(component, next);
  }

  function tableViewOf(component: TableComponent): TableViewState {
    return tableViews[component.id] ?? { pageIndex: 0, sort: [], headerFilters: {} };
  }

  function handleTablePage(component: TableComponent, pageIndex: number) {
    pushTableView(component, { ...tableViewOf(component), pageIndex });
    if (component.props.pagination?.mode === 'query') {
      stream?.setQueryPage(component.data.main, pageIndex);
    }
  }

  function handleTablePageSize(component: TableComponent, pageSize: number) {
    if (!Number.isInteger(pageSize) || pageSize <= 0) return;
    tablePageSizes = { ...tablePageSizes, [component.id]: pageSize };
    pushTableView(component, { ...tableViewOf(component), pageIndex: 0 });
    if (component.props.pagination?.mode === 'query') {
      stream?.setQueryPageSize(component.data.main, pageSize);
    }
  }

  function handleTableSort(component: TableComponent, sort: TableViewState['sort']) {
    pushTableView(component, { ...tableViewOf(component), sort, pageIndex: 0 });
  }

  function handleTableHeaderFilter(
    component: TableComponent,
    field: string,
    value: TableHeaderFilterValue | null
  ) {
    const current = tableViewOf(component);
    const headerFilters = { ...current.headerFilters };
    if (value === null) delete headerFilters[field];
    else headerFilters[field] = value;
    const draft = { ...current, headerFilters };
    setTableView(component, draft);

    if (!shouldApplyTableHeaderFilter(value)) return;
    const applied = { ...appliedHeaderFiltersOf(component) };
    if (value === null) delete applied[field];
    else applied[field] = value;
    appliedTableHeaderFilters = {
      ...appliedTableHeaderFilters,
      [component.id]: applied
    };
    const next = { ...draft, pageIndex: 0 };
    setTableView(component, next);
  }

  function tableSelectedCell(component: TableComponent): TableSelectedCell | undefined {
    const columns = buildTableColumnLayout(component.props.columns).leaves;
    const rows = visibleTableRows(component);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]!;
      for (const column of columns) {
        if (!column.selection) continue;
        const matches = Object.entries(column.selection.writes).every(
          ([filterId, write]) => {
            const current = filterValues.get(filterId);
            const expected =
              'field' in write ? row[fieldName(write.field)] : write.value;
            return (
              current?.type === 'dimension' &&
              expected != null &&
              current.values.length === 1 &&
              current.values[0] === String(expected)
            );
          }
        );
        if (matches) return { rowIndex, columnField: fieldName(column.field) };
      }
    }
    return undefined;
  }

  function handleTableCellSelect(
    component: TableComponent,
    rowIndex: number,
    column: TableColumn
  ) {
    if (!column.selection || !componentCapability(component)?.actions) return;
    const row = visibleTableRows(component)[rowIndex];
    if (!row) return;

    const updates: Array<readonly [string, FilterValue | null]> = [];
    for (const [filterId, write] of Object.entries(column.selection.writes)) {
      const declaration = declarations.find((candidate) => candidate.id === filterId);
      const raw = 'field' in write ? row[fieldName(write.field)] : write.value;
      if (declaration?.type !== 'dimension' || raw == null) return;
      updates.push([
        filterId,
        {
          type: 'dimension',
          dimension: declaration.dimension,
          values: [String(raw)]
        }
      ]);
    }
    filterState?.writeMany(updates);
  }

  function resetTablePages(loaded: Page, previous: FilterValues, next: FilterValues) {
    const changed = new Set<string>();
    for (const id of new Set([...previous.keys(), ...next.keys()])) {
      if (JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id))) changed.add(id);
    }
    for (const component of pageComponents(loaded)) {
      if (
        component.type !== 'table' ||
        component.props.pagination?.mode !== 'query'
      ) {
        continue;
      }
      const view = tableViewOf(component);
      if (view.pageIndex === 0) continue;
      const source = loaded.dataSources[component.data.main];
      const subscriptions =
        source?.source.type === 'query'
          ? Object.keys(source.source.query.filterBindings ?? {})
          : [];
      if (!subscriptions.some((id) => changed.has(id))) continue;
      pushTableView(component, { ...view, pageIndex: 0 });
    }
  }

  function syncQueryTablePages(loaded: Page, next: PageDataSnapshots) {
    for (const component of pageComponents(loaded)) {
      if (component.type !== 'table' || component.props.pagination?.mode !== 'query') {
        continue;
      }
      const snapshot = next.get(component.data.main);
      if (
        !snapshot ||
        (snapshot.status !== 'ready' && snapshot.status !== 'empty') ||
        snapshot.totalCount === undefined
      ) {
        continue;
      }
      const pageSize = effectiveTablePageSize(loaded, component);
      if (pageSize === undefined) continue;
      const lastPageIndex = Math.max(0, Math.ceil(snapshot.totalCount / pageSize) - 1);
      const view = tableViewOf(component);
      if (view.pageIndex > lastPageIndex) {
        pushTableView(component, { ...view, pageIndex: lastPageIndex });
      }
    }
  }

  function parseFilterURL(search: string, declared: FilterDeclaration[]): FilterValues {
    const probe = createFilterState();
    probe.fromURL(search);
    let parsed: FilterValues = new Map();
    probe.subscribe((value) => {
      parsed = value;
    })();
    const ids = new Set(declared.map((declaration) => declaration.id));
    return new Map([...parsed].filter(([id]) => ids.has(id)));
  }

  function mergedSearch(state: FilterState, initial: string): string {
    const params = new URLSearchParams(initial);
    for (const declaration of declarations) params.delete(declaration.id);
    for (const [key, value] of new URLSearchParams(state.toURL())) params.set(key, value);
    return params.toString();
  }

  function writeDimension(
    declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
    values: string[],
    level?: string
  ) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    const dimension =
      declaration.hierarchy && level
        ? (declaration.hierarchy.find((item) => item.id === level)?.dimension ??
          declaration.dimension)
        : declaration.dimension;
    filterState?.writeMany([
      [
        declaration.id,
        values.length > 0
          ? {
              type: 'dimension',
              dimension,
              values,
              ...(level ? { level } : {})
            }
          : null
      ],
      ...clearDependentUpdates(declarations, declaration.id)
    ]);
    reloadDependentCandidates(declaration.id);
  }

  function writeTimeRange(filterId: string, range: TimeRangeValue | null) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(filterId, range ? { type: 'timeRange', ...range } : null);
  }

  function writeTimePoint(
    filterId: string,
    granularity: 'month' | 'date',
    value: string | null
  ) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(filterId, value ? { type: 'timePoint', granularity, value } : null);
  }

  function writeBoolean(filterId: string, checked: boolean) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(filterId, checked ? { type: 'boolean', value: true } : null);
  }

  function writeNumberRange(filterId: string, range: NumberRangeValue | null) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(filterId, range ? { type: 'numberRange', ...range } : null);
  }

  function writeSearch(filterId: string, query: string) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(filterId, query.trim() === '' ? null : { type: 'search', query });
  }

  function loadDimensionCandidates(
    loader: NonNullable<typeof candidatesLoader>,
    declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
    values: FilterValues
  ) {
    const constraints = cascadeConstraints(declaration, declarations, values);
    if (declaration.hierarchy) {
      for (const level of declaration.hierarchy) {
        loader.load(level.dimension, constraints);
      }
      return;
    }
    loader.load(declaration.dimension, constraints);
  }

  function reloadDependentCandidates(parentId: string) {
    if (!candidatesLoader) return;
    for (const declaration of declarations) {
      if (declaration.type !== 'dimension' || declaration.dependsOn !== parentId) continue;
      const constraints = cascadeConstraints(declaration, declarations, filterValues);
      const current = dimensionValueOf(filterValues, declaration.id);
      const dimension = declaration.hierarchy
        ? (declaration.hierarchy.find((item) => item.id === current.level)?.dimension ??
          declaration.hierarchy[0]!.dimension)
        : declaration.dimension;
      candidatesLoader.reload(dimension, constraints);
    }
  }

  function handleTableLink(component: TableComponent, row: Row) {
    if (!componentCapability(component)?.actions) return;
    for (const action of component.props.actions ?? []) {
      if ('navigate' in action) {
        const search = drillThroughSearch(action.navigate, filterValues, row);
        navigate(action.navigate.page, search);
        return;
      }
    }
  }

  function handleMetricLink(component: Component, row: Row) {
    if (component.type !== 'metricCard' || !componentCapability(component)?.actions) return;
    for (const action of component.props.actions ?? []) {
      if (!('navigate' in action)) continue;
      const search = drillThroughSearch(action.navigate, filterValues, row);
      navigate(action.navigate.page, search);
      return;
    }
  }

  function handleChartClick(component: ChartComponent, row: Row) {
    if (!componentCapability(component)?.actions) return;
    if (component.type === 'mapChart' && component.props.hierarchyFilter) {
      const declaration = declarations.find(
        (item) => item.id === component.props.hierarchyFilter
      );
      if (isHierarchyDeclaration(declaration)) {
        const decision = resolveMapClick(
          component.props,
          declaration,
          filterValues.get(declaration.id),
          row
        );
        if (decision.kind === 'ignore') return;
        if (decision.kind === 'drill') {
          writeDimension(declaration, decision.value.values, decision.value.level);
          return;
        }
      }
    }
    for (const action of component.props.actions ?? []) {
      if ('navigate' in action) {
        const search = drillThroughSearch(action.navigate, filterValues, row);
        navigate(action.navigate.page, search);
        return;
      }
      const code = fieldName(action.field);
      const clicked = row[code];
      const target = declarations.find((declaration) => declaration.id === action.writeFilter);
      if (clicked == null || target?.type !== 'dimension') continue;
      filterState?.write(action.writeFilter, {
        type: 'dimension',
        dimension: target.dimension,
        values: [String(clicked)]
      });
    }
  }

  function textLink(link: TextLink) {
    const search = drillThroughSearch(
      { page: link.page, carryFilters: link.carryFilters },
      filterValues,
      {}
    );
    return {
      label: link.label,
      href: navigation?.href(link.page, search) ?? `#metriccanvas-page-${link.page}`,
      onclick: (event: MouseEvent) => {
        event.preventDefault();
        navigate(link.page, search);
      }
    };
  }

  function navigate(pageId: string, search: string) {
    const href = navigation?.href(pageId, search) ?? `#metriccanvas-page-${pageId}`;
    const sourcePageId = pageState.phase === 'ready' ? pageState.page.id : undefined;
    const sourceSearch = filterState ? mergedSearch(filterState, initialSearch) : initialSearch;
    onevent?.({ type: 'navigate', pageId, search, sourcePageId, sourceSearch });
    navigation?.navigate({ pageId, search, href, sourcePageId, sourceSearch });
  }

  function componentSnapshots(component: Component): ComponentSnapshots {
    return new Map(
      Object.entries(component.data ?? {}).map(([slot, sourceId]) => [
        slot,
        snapshots.get(sourceId) ?? ({ status: 'loading' } as DataSnapshot)
      ])
    );
  }

  function componentData(
    loaded: Page,
    component: Component,
    snapshotsBySlot: ComponentSnapshots
  ): NamedDataSlots {
    const data: NamedDataSlots = {};
    for (const [slot, sourceId] of Object.entries(component.data ?? {})) {
      const snapshot = snapshotsBySlot.get(slot);
      const source = loaded.dataSources[sourceId];
      if (!source || !snapshot) continue;
      const fields = resolveDataSourceFields(source);
      const renderable = renderableDataSnapshot(snapshot);
      if (!renderable) continue;
      let visible =
        component.type === 'table' && slot === 'main'
          ? tableSnapshot(component, renderable)
          : renderable;
      if (
        component.type === 'mapChart' &&
        slot === 'main' &&
        component.props.hierarchyFilter
      ) {
        const declaration = declarations.find(
          (item) => item.id === component.props.hierarchyFilter
        );
        if (isHierarchyDeclaration(declaration)) {
          visible = {
            ...visible,
            rows: filterMapRows(
              visible.rows,
              component.props,
              declaration,
              filterValues.get(declaration.id)
            )
          };
        }
      }
      data[slot] = { snapshot: visible, fields };
    }
    return data;
  }

  function visibleTableRows(component: TableComponent): Row[] {
    const snapshot = componentSnapshots(component).get('main');
    return snapshot?.status === 'ready'
      ? tableSnapshot(component, snapshot).rows
      : [];
  }

  function tableSnapshot(
    component: TableComponent,
    snapshot: Extract<DataSnapshot, { status: 'ready' }>
  ): Extract<DataSnapshot, { status: 'ready' }> {
    const view = tableViewOf(component);
    if (component.props.pagination?.mode === 'query') {
      return snapshot;
    }
    const applied = appliedHeaderFiltersOf(component);
    const source = pageState.phase === 'ready' ? pageState.page.dataSources[component.data.main] : undefined;
    const searched = applySearchFilters(
      snapshot.rows,
      filterValues,
      source ? resolveDataSourceFields(source) : {}
    );
    let rows = searched.filter((row) =>
      Object.entries(applied).every(([field, filter]) => {
        const value = row[field];
        if (filter.mode === 'select') {
          return filter.values.includes(String(value ?? ''));
        }
        const comparable = String(value ?? '');
        return (
          (!filter.from || comparable >= filter.from) &&
          (!filter.to || comparable <= filter.to)
        );
      })
    );
    if (view.sort.length > 0) {
      rows = [...rows].sort((left, right) => {
        for (const rule of view.sort) {
          const a = left[rule.field];
          const b = right[rule.field];
          const comparison =
            a == null && b == null
              ? 0
              : a == null
                ? -1
                : b == null
                  ? 1
                  : a < b
                    ? -1
                    : a > b
                      ? 1
                      : 0;
          if (comparison !== 0) {
            return rule.direction === 'desc' ? -comparison : comparison;
          }
        }
        return 0;
      });
    }
    if (component.props.pagination?.mode !== 'local') {
      return { status: 'ready', rows };
    }
    const pageSize = tablePageSizes[component.id] ?? component.props.pagination.pageSize;
    const offset = view.pageIndex * pageSize;
    return {
      status: 'ready',
      rows: rows.slice(offset, offset + pageSize)
    };
  }

  /** 表头筛选候选项:只投影 ready 快照的真实候选值;其余状态不给表头假候选。 */
  function remoteHeaderOptions(): Record<string, string[]> {
    const options: Record<string, string[]> = {};
    for (const [dimension, snapshot] of dimensionCandidates) {
      if (snapshot.status === 'ready') {
        options[dimension] = snapshot.candidates.map((candidate) => candidate.value);
      }
    }
    return options;
  }

  function tableFilterOptions(component: TableComponent): Record<string, string[]> {
    if (component.props.pagination?.mode === 'query') return {};
    const snapshot = componentSnapshots(component).get('main');
    if (snapshot?.status !== 'ready') return remoteHeaderOptions();
    const fields = buildTableColumnLayout(component.props.columns).leaves
      .filter((column) => column.filterable?.mode === 'select')
      .map((column) => fieldName(column.field));
    const local = Object.fromEntries(
      fields.map((field) => [
        field,
        [...new Set(snapshot.rows.map((row) => row[field]).filter((value) => value != null).map(String))]
      ])
    );
    return { ...local, ...remoteHeaderOptions() };
  }

  function tablePaginationState(
    loaded: Page,
    component: TableComponent,
    snapshotsBySlot: ComponentSnapshots
  ): TablePaginationState | undefined {
    const pagination = component.props.pagination;
    if (!pagination || pagination.mode === 'none') return undefined;
    const snapshot = snapshotsBySlot.get('main');
    if (!snapshot || (snapshot.status !== 'ready' && snapshot.status !== 'empty')) {
      return undefined;
    }
    if (pagination.mode === 'local') {
      const totalCount = snapshot.status === 'ready' ? snapshot.rows.length : 0;
      return {
        pageSize: tablePageSizes[component.id] ?? pagination.pageSize,
        totalCount
      };
    }
    const pageSize = effectiveTablePageSize(loaded, component);
    if (pageSize === undefined || snapshot.totalCount === undefined) return undefined;
    return { pageSize, totalCount: snapshot.totalCount };
  }

  function queryPageSize(loaded: Page, component: TableComponent): number | undefined {
    const source = loaded.dataSources[component.data.main];
    if (source?.source.type !== 'query') return undefined;
    const order = source.source.query.body.dsl_list[0].order;
    if (typeof order !== 'object' || order === null || Array.isArray(order)) return undefined;
    return typeof order.limit === 'number' && Number.isInteger(order.limit) && order.limit > 0
      ? order.limit
      : undefined;
  }

  function effectiveTablePageSize(
    loaded: Page,
    component: TableComponent
  ): number | undefined {
    return tablePageSizes[component.id] ?? queryPageSize(loaded, component);
  }

  function tableBinding(
    loaded: Page,
    component: Component,
    slots: ComponentSnapshots
  ): TableRenderBinding | undefined {
    if (component.type !== 'table') return undefined;
    return {
      view: tableViewOf(component),
      selectedCell: tableSelectedCell(component),
      filterOptions: tableFilterOptions(component),
      pagination: tablePaginationState(loaded, component, slots),
      onpage: (pageIndex) => handleTablePage(component, pageIndex),
      onpagesize: (pageSize) => handleTablePageSize(component, pageSize),
      onsort: (sort) => handleTableSort(component, sort),
      onheaderfilter: (field, value) => handleTableHeaderFilter(component, field, value),
      oncellselect: ({ rowIndex, column }) =>
        handleTableCellSelect(component, rowIndex, column),
      onlink: ({ row }) => handleTableLink(component, row)
    };
  }

  function chartClickHandler(component: Component): ((row: Row) => void) | undefined {
    if (!componentCapability(component)?.actions || !isChartComponent(component)) {
      return undefined;
    }
    const chart: ChartComponent = component;
    return (row: Row) => handleChartClick(chart, row);
  }

  function metricLinkHandler(component: Component): ((row: Row) => void) | undefined {
    if (
      component.type !== 'metricCard' ||
      !componentCapability(component)?.actions ||
      !component.props.actions?.some((action) => 'navigate' in action)
    ) {
      return undefined;
    }
    return (row: Row) => handleMetricLink(component, row);
  }

  function mapOverride(component: Component): 'china' | 'world' | undefined {
    if (component.type !== 'mapChart' || !component.props.hierarchyFilter) return undefined;
    const declaration = declarations.find((item) => item.id === component.props.hierarchyFilter);
    if (!isHierarchyDeclaration(declaration)) return undefined;
    return resolveMapBasemap(
      component.props,
      declaration,
      filterValues.get(declaration.id)
    );
  }

  function nestedRender(loaded: Page): NestedComponentRender {
    return {
      data: (child) => componentData(loaded, child, componentSnapshots(child)),
      snapshot: (child) => hostRenderSnapshot(child, componentSnapshots(child)),
      table: (child) => tableBinding(loaded, child, componentSnapshots(child)),
      onchartclick: chartClickHandler,
      onmetriclink: metricLinkHandler,
      map: mapOverride
    };
  }
</script>

<div class="runtime-view">
  {#if pageState.phase === 'loading'}
    <p class="muted">加载页面…</p>
  {:else if pageState.phase === 'configuration-error'}
    <div class="error-page">
      <h1>统一运行时接入配置不完整</h1>
      <p><code class="badge">{pageState.error.code}</code></p>
      <p>{pageState.error.message}</p>
    </div>
  {:else if pageState.phase === 'params-incomplete'}
    <div class="error-page">
      <h1>页面输入不完整</h1>
      <p class="muted">以下页面参数是必需的，请检查链接是否被裁剪。</p>
      <ul class="errors">
        {#each pageState.missing as declaration (declaration.id)}
          <li>
            <code class="path">{declaration.id}</code>
            <span>{declaration.label ?? '缺少取值'}</span>
          </li>
        {/each}
      </ul>
    </div>
  {:else if pageState.phase === 'invalid'}
    <div class="error-page">
      <h1>页面文档未通过校验</h1>
      <p class="muted">修复以下错误后保存，页面会自动刷新。</p>
      <ul class="errors">
        {#each pageState.errors as error}
          <li>
            <code class="badge">{error.type}</code>
            <code class="path">{error.path}</code>
            <span>{error.message}</span>
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    {@const readyPage = pageState.page}
    {@const layoutForm = readyPage.layoutForm ?? 'report'}
    {@const dashboardToolbar = readyPage.dashboardToolbar ?? 'visible'}
    {@const dashboardToolbarConfig =
      typeof dashboardToolbar === 'object' ? dashboardToolbar : undefined}
    {@const groupedDashboardFilters = dashboardFilterGroups(
      declarations,
      dashboardToolbarConfig?.variant
    )}
    <div
      class:layout-dashboard={layoutForm === 'dashboard'}
      class:dashboard-toolbar-hidden={
        layoutForm === 'dashboard' && dashboardToolbar === 'hidden'
      }
      class="page-content"
      data-page-layout-form={layoutForm}
      data-dashboard-toolbar={typeof dashboardToolbar === 'string'
        ? dashboardToolbar
        : dashboardToolbar.variant}
    >
    {#if layoutForm === 'dashboard' && dashboardToolbar !== 'hidden'}
      <DashboardToolbar
        title={pageListEntry(readyPage).title}
        {declarations}
        values={filterValues}
        candidates={dimensionCandidates}
        ondimension={writeDimension}
        ontimerange={writeTimeRange}
        ontimepoint={writeTimePoint}
        onboolean={writeBoolean}
        onnumberrange={writeNumberRange}
        onsearch={writeSearch}
        variant={dashboardToolbarConfig?.variant}
        readOnly={dashboardToolbarConfig?.readOnly}
        note={dashboardToolbarConfig?.note}
        onback={navigation?.back}
      />
    {:else if pageState.capabilities.filters && hasVisibleFilters(declarations)}
      <FilterBar
        {declarations}
        values={filterValues}
        candidates={dimensionCandidates}
        ondimension={writeDimension}
        ontimerange={writeTimeRange}
        ontimepoint={writeTimePoint}
        onboolean={writeBoolean}
        onnumberrange={writeNumberRange}
        onsearch={writeSearch}
      />
    {/if}

    {#if layoutForm === 'dashboard' &&
      dashboardToolbar !== 'hidden' &&
      groupedDashboardFilters.content.length > 0}
      <div data-dashboard-content-filters class="dashboard-content-filters">
        <FilterBar
          declarations={groupedDashboardFilters.content}
          values={filterValues}
          candidates={dimensionCandidates}
          ondimension={writeDimension}
          ontimerange={writeTimeRange}
          ontimepoint={writeTimePoint}
          onboolean={writeBoolean}
          onnumberrange={writeNumberRange}
          onsearch={writeSearch}
        />
      </div>
    {/if}

    <div class="page-sections">
      {#each renderedSections as section (section.id)}
        <RuntimeSection {section} {authoring}>
          {#snippet componentContent(component: Component)}
            {@const slots = componentSnapshots(component)}
            <ComponentRenderer
              {component}
              data={componentData(readyPage, component, slots)}
              snapshot={hostRenderSnapshot(component, slots)}
              pageSnapshots={snapshots}
              {aiSummary}
              textLinks={component.type === 'text'
                ? (component.props.links ?? []).map(textLink)
                : []}
              onchartclick={chartClickHandler(component)}
              onmetriclink={metricLinkHandler(component)}
              onback={navigation?.back}
              table={tableBinding(readyPage, component, slots)}
              map={mapOverride(component)}
              nested={nestedRender(readyPage)}
            />
          {/snippet}
        </RuntimeSection>
      {/each}
    </div>
    </div>
  {/if}
</div>

<style>
  .runtime-view {
    container: mc-runtime / inline-size;

    --mc-color-canvas: #daeaff;
    /* 看板形态画布:中性灰,让白色分区自己成为模块边界。 */
    --mc-color-dashboard-canvas: #f8f8f8;
    --mc-color-surface: #fff;
    --mc-color-surface-subtle: #f1f4ff;
    --mc-color-text: #18181b;
    --mc-color-text-strong: #0f1a4d;
    --mc-color-muted: #71717a;
    --mc-color-primary: #08359e;
    --mc-color-accent: #4f46e5;
    --mc-color-border: #e4e4e7;
    --mc-color-danger: #b91c1c;
    --mc-color-positive: #52c41a;
    --mc-color-negative: #f5222d;
    --mc-color-report-positive: #5cb300;
    --mc-color-report-negative: #f21e1e;
    --mc-color-report-heading: #121e3b;
    --mc-color-report-text: #191919;
    --mc-color-report-rank-muted: #697386;
    --mc-color-report-description: #595959;
    --mc-color-report-badge: #1476ff;
    --mc-color-report-badge-surface: #e8f1ff;
    --mc-color-report-header-accent: #2098ff;
    --mc-color-report-content-frame: #d4d5ff;
    --mc-color-report-content-surface: #fcfcff;
    --mc-font-size-report-level-3: 20px;
    --mc-font-size-report-level-4: 18px;
    --mc-radius-cell: 10px;
    --mc-radius-report-content: 12px;
    --mc-radius-section: 16px;
    /* 分区面板外观真源:RuntimeSection(container-panel)、ReportHeader 摘要区
       与 MetricCard 渐变变体共用。角度与色标位置换算自 Pixso SVG 的线性渐变向量。 */
    --mc-section-gradient: linear-gradient(
      204deg,
      rgb(218 214 255) 4%,
      rgb(189 213 255) 45%
    );
    --mc-section-panel-padding: 15px 28px 29px;
    --mc-section-panel-background: var(--mc-section-gradient);
    --mc-section-panel-radius: 20px;

    /* 分区居中图标标题真源:RuntimeSection、ReportHeader 摘要标题、TextBlock(heading) 共用。 */
    --mc-section-title-gap: 12px;
    --mc-section-title-font-size: 32px;
    --mc-section-title-font-weight: 600;
    --mc-section-title-line-height: 50px;
    --mc-section-title-icon-size: 20px;

    /* 摘要块(insight)外观真源:TextBlock(insight) 与 AI 总结 View 共用。 */
    --mc-insight-padding: 15px 18px 15px 15px;
    --mc-insight-radius: 16px;
    --mc-insight-heading-margin: 0 0 15px 5px;
    --mc-insight-heading-font-size: 20px;
    --mc-insight-heading-line-height: 25px;
    --mc-insight-body-padding: 9px 27px 12px 12px;
    --mc-insight-body-radius: 8px;
    --mc-insight-body-font-size: 18px;
    --mc-insight-body-line-height: 30px;

    width: 100%;
    min-width: 0;
    color: var(--mc-color-text);
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', sans-serif;
  }
  .runtime-view :global(*) {
    box-sizing: border-box;
  }
  .muted {
    color: var(--mc-color-muted);
  }
  .page-content {
    --mc-page-content-padding-block-start: 28px;
    --mc-page-content-padding-inline: 18px;

    width: 100%;
    max-width: 75rem;
    box-sizing: border-box;
    margin: 0 auto;
    min-height: 100vh;
    padding: var(--mc-page-content-padding-block-start)
      var(--mc-page-content-padding-inline) 54px;
    background: var(--mc-color-canvas);
  }
  /* 看板形态:占满宿主给出的全部宽度,中性画布,分区之间只靠间距分隔。
     报表形态的定宽居中与浅蓝画布留在 `.page-content` 缺省规则里不动,
     两档的差别全部落在这一处,分区内部的 12 列网格两档共用。

     ==== 这一处就是「按页面布局形态生效的 token 通道」的唯一定义点 ====
     规则只有两条,新增量之前先对着它判一次:
     ① 只有「两档形态取值不同」和「跨文件下发」两类量走 --mc-,其余保持字面量;
     ② 报表形态的取值一律留在**消费点的 var() 缺省值**里,不在这里也不在
        `.runtime-view` 根部重复一遍。因此这个块只增不改:块里出现的每一行
        都是看板档,把某一行删掉就退回报表档,报表形态因此不可能被这里改到。
     消费点跨包时(色板、卡片标题、筛选控件铬)名字仍以这里为真源,
     不允许任一消费方改自己的缺省字面量来「就地调档」。 */
  .page-content.layout-dashboard {
    --mc-page-content-padding-block-start: 0;
    --mc-page-content-padding-inline: 0;
    --mc-page-sections-margin-top: 16px;
    --mc-section-card-padding: 16px 20px 20px;
    --mc-section-card-title-margin: 0 0 12px;
    --mc-section-card-title-color: var(--mc-color-report-text);
    --mc-section-card-title-font-size: 16px;
    --mc-section-card-title-font-weight: 500;
    --mc-section-card-title-line-height: 24px;
    --mc-section-card-grid-gap: 16px;
    --mc-section-card-grid-column-gap: 16px;
    --mc-section-plain-grid-gap: 16px;
    --mc-section-plain-grid-column-gap: 16px;
    --mc-metric-panel-surface: var(--mc-color-surface);
    --mc-metric-panel-radius: var(--mc-radius-section);
    --mc-metric-panel-padding: 16px 20px;
    --mc-gauge-surface: var(--mc-color-surface);
    --mc-gauge-radius: var(--mc-radius-section);
    --mc-gauge-padding: 16px 12px;
    --mc-section-default-padding: 0;
    --mc-section-default-surface: transparent;
    --mc-section-default-shadow: none;
    --mc-cell-padding: 16px 20px 20px;
    --mc-cell-radius: var(--mc-radius-section);
    --mc-cell-shadow: none;
    --mc-field-text-body-surface: rgb(0 0 0 / 0.03);
    --mc-field-text-body-radius: 8px;
    --mc-field-text-body-padding: 14px 17px;

    /* 图表色板。不是 CSS 声明而是要塞进 ECharts option 的数据,由图表组件从
       自己的绘图容器读计算样式(见 widgets/src/shared/chart-palette.ts)。
       报表形态不定义这两个名字,图表因此沿用图表库内置色板与连续渐变。 */
    --mc-chart-categorical-colors: #5b72ea, #3cc6c1, #fec72a, #4ba0f7;
    /* 分档色从**高档到低档**;档数由色列长度决定。 */
    --mc-chart-map-scale-colors: #7184e7, #acb9f0, #d9dff6, rgba(0, 0, 0, 0.05);

    /* 卡面无边框:宽度归零而不是把颜色改透明,否则留下 1px 占位。 */
    --mc-cell-border-width: 0;
    --mc-metric-panel-border-width: 0;
    --mc-gauge-border: 0;

    /* 卡内分隔线 */
    --mc-cell-divider-color: #dcdbdb;

    /* 组件卡片标题:报表形态下这一族在十个文件里各有一套字号字重,
       看板形态收敛成同一档。 */
    --mc-card-title-font-size: 16px;
    --mc-card-title-font-weight: 500;
    --mc-card-title-line-height: 24px;
    --mc-card-title-color: var(--mc-color-report-text);

    /* 页面标题(字号两档同为 24px,不设量) */
    --mc-page-title-font-weight: 500;
    --mc-page-title-line-height: 36px;
    --mc-page-title-color: var(--mc-color-report-text);

    /* 指标行:标签、大数字、数值单位 */
    --mc-metric-label-font-size: 14px;
    --mc-metric-label-line-height: 20px;
    --mc-metric-label-color: var(--mc-color-report-text);
    --mc-metric-value-font-size: 28px;
    --mc-metric-value-font-weight: 400;
    --mc-metric-value-line-height: 34px;
    --mc-metric-value-color: var(--mc-color-report-text);
    --mc-metric-unit-font-size: 14px;
    --mc-metric-unit-font-weight: 400;
    --mc-metric-unit-line-height: 20px;
    --mc-metric-unit-color: var(--mc-color-report-text);

    /* 表格:表头高度与底色、行高、横竖分隔线同色 */
    --mc-table-header-row-height: 64px;
    --mc-table-header-surface: rgb(0 0 0 / 0.05);
    --mc-table-header-border: rgb(0 0 0 / 0.15);
    --mc-table-row-height: 48px;
    --mc-table-cell-border: rgb(0 0 0 / 0.15);

    /* Tab:整条底边着色的下划线页签换成短指示条,轨保留 1px */
    --mc-tab-font-size: 16px;
    --mc-tab-active-font-weight: 500;
    --mc-tab-active-color: var(--mc-color-report-text);
    --mc-tab-active-underline-color: transparent;
    --mc-tab-indicator: linear-gradient(currentcolor, currentcolor) bottom center /
      32px 2px no-repeat border-box;
    --mc-tab-track-color: rgb(25 25 25 / 0.1);

    /* 筛选控件:字段名不再外置,当前值自己就是控件的所指 */
    --mc-filter-font-size: 14px;
    --mc-filter-control-min-width: 220px;
    --mc-filter-control-height: 34px;
    --mc-filter-control-radius: 6px;
    --mc-filter-control-border-color: #c2c2c2;
    --mc-filter-label-display: none;

    /* 长文本正文行高(冻结基线 R3-3) */
    --mc-field-text-body-line-height: 28px;

    max-width: none;
    padding: var(--mc-page-content-padding-block-start)
      var(--mc-page-content-padding-inline);
    color: var(--mc-color-report-text);
    background: var(--mc-color-dashboard-canvas);
  }
  .page-content.layout-dashboard.dashboard-toolbar-hidden {
    --mc-page-sections-margin-top: 0;
  }
  .dashboard-content-filters {
    --mc-filter-bar-flex: 1;
    --mc-filter-bar-padding: 0;
    --mc-filter-bar-margin: 0;
    --mc-filter-bar-background: transparent;
    --mc-filter-bar-border: 0;
    --mc-filter-bar-radius: 0;

    display: flex;
    padding: 16px 24px 0 23px;
  }
  .page-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: var(--mc-page-sections-margin-top, 0);
  }
  .page-content.layout-dashboard > .page-sections {
    /* 看板内容轨只保留 23/24px 非对称页面内距；实际宽度始终由宿主容器决定。 */
    padding-right: 24px;
    padding-left: 23px;
  }
  .page-content.layout-dashboard[data-dashboard-toolbar='compact'] {
    --mc-page-sections-margin-top: 0;
  }
  .page-content.layout-dashboard[data-dashboard-toolbar='compact'] > .page-sections {
    padding: 16px 24px 24px;
  }
  @container mc-runtime (max-width: 1050px) {
    .page-content {
      --mc-page-content-padding-inline: 12px;
    }
  }
  .error-page h1 {
    font-size: 20px;
  }
  .errors {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    list-style: none;
  }
  .errors li {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    font-size: 14px;
  }
  .badge {
    color: var(--mc-color-danger);
    font-size: 12px;
    font-weight: 700;
  }
  .path {
    color: var(--mc-color-muted);
    font-size: 13px;
  }
</style>
