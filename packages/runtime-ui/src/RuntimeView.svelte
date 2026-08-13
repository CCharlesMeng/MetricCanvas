<script lang="ts">
  import {
    dataSourceMode,
    derivePageCapabilities,
    fieldName,
    isChartComponent,
    parsePage,
    resolveDataSourceFields,
    type ChartComponent,
    type Component,
    type ComponentCapabilities,
    type DataSnapshot,
    type FilterDeclaration,
    type Page,
    type Row,
    type TableColumn,
    type TableComponent,
    type TextLink,
    type TypedError
  } from '@metriccanvas/page';
  import {
    createDimensionValuesLoader,
    createFilterState,
    dimensionValuesSnapshot,
    drillThroughSearch,
    initialFilterValues,
    orchestrate,
    type DimensionValuesSnapshots,
    type FilterState,
    type FilterValue,
    type FilterValues,
    type PageDataSnapshots,
    type PageSnapshotStream,
    type RuntimeDataGateway
  } from '@metriccanvas/runtime';
  import {
    BarChart,
    LineChart,
    MapChart,
    MetricCard,
    PieChart,
    RankingCard,
    RankingDetailCard,
    ReportHeader,
    Table,
    TextBlock,
    buildTableColumnLayout,
    initialTableSort,
    shouldApplyTableHeaderFilter,
    type MainDataSlots,
    type MetricDataSlots,
    type NamedDataSlots,
    type TableHeaderFilterValue,
    type TablePaginationState,
    type TableSelectedCell,
    type TableViewState
  } from '@metriccanvas/widgets';
  import AiSummaryHost from './ai-summary/AiSummaryHost.svelte';
  import { collectDataErrors } from './data-error-events';
  import DimensionFilter from './filters/DimensionFilter.svelte';
  import TimeRangeFilter from './filters/TimeRangeFilter.svelte';
  import WidgetHost from './WidgetHost.svelte';
  import { renderableDataSnapshot } from './widget-host-state';
  import RuntimeSection from './RuntimeSection.svelte';
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
    | { phase: 'ready'; page: Page; capabilities: PageCapabilities };

  // inline 页面不访问数据网关;候选值能力缺席即不可用,不需要抛错桩。
  const inlineGateway: RuntimeDataGateway = {
    async fetchData() {
      throw new Error('inline 看板页面不应访问数据网关');
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
  let stream: PageSnapshotStream | null = null;
  let session = 0;
  let disposers: Array<() => void> = [];

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

    const parsed = parsePage(raw);
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
    const candidatesLoader = createDimensionValuesLoader(activeGateway);
    disposers.push(() => candidatesLoader.dispose());
    disposers.push(
      candidatesLoader.subscribe((next) => {
        if (session !== mySession) return;
        dimensionCandidates = next;
      })
    );

    for (const declaration of declarations) {
      if (declaration.type !== 'dimension') continue;
      candidatesLoader.load(declaration.dimension);
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
        `${mode} 看板页面必须提供数据网关。`
      );
    }
    return null;
  }

  function pageComponents(loaded: Page): Component[] {
    return loaded.sections.flatMap((section) => section.components);
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

  function dimensionValue(filterId: string): string[] {
    const value = filterValues.get(filterId);
    return value?.type === 'dimension' ? value.values : [];
  }

  function timeRangeValue(filterId: string) {
    const value = filterValues.get(filterId);
    return value?.type === 'timeRange' ? { from: value.from, to: value.to } : null;
  }

  function writeDimension(
    declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
    values: string[]
  ) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(
      declaration.id,
      values.length > 0
        ? { type: 'dimension', dimension: declaration.dimension, values }
        : null
    );
  }

  function writeTimeRange(filterId: string, range: { from: string; to: string } | null) {
    if (pageState.phase !== 'ready' || !pageState.capabilities.filters) return;
    filterState?.write(filterId, range ? { type: 'timeRange', ...range } : null);
  }

  function handleChartClick(component: ChartComponent, row: Row) {
    if (!componentCapability(component)?.actions) return;
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
    onevent?.({ type: 'navigate', pageId, search });
    navigation?.navigate({ pageId, search, href });
  }

  function componentSnapshots(component: Component): ComponentSnapshots {
    return new Map(
      Object.entries(component.data ?? {}).map(([slot, sourceId]) => [
        slot,
        snapshots.get(sourceId) ?? ({ status: 'loading' } as DataSnapshot)
      ])
    );
  }

  function hostSnapshot(
    component: Component,
    slots: ComponentSnapshots
  ): DataSnapshot {
    const values = Object.keys(component.data ?? {}).map(
      (slot) => slots.get(slot) ?? ({ status: 'loading' } as const)
    );
    const error = values.find(
      (snapshot): snapshot is Extract<DataSnapshot, { status: 'error' }> =>
        snapshot.status === 'error'
    );
    if (error) return error;
    if (values.some((snapshot) => snapshot.status === 'loading')) {
      return { status: 'loading' };
    }
    // 实际/预测边界规则只在创作期执行(validate.ts 对内嵌初始行校验)。
    // 这里不再对实时快照复检:筛选/分页后的行属新数据时点,用冻结的
    // initial.capturedAt 判定会误报;报告场景(ADR-0020)数据本就冻结在采集时点。
    if (component.type !== 'table' && slots.get('main')?.status === 'empty') {
      return { status: 'empty' };
    }
    return { status: 'ready', rows: [] };
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
      const visible =
        component.type === 'table' && slot === 'main'
          ? tableSnapshot(component, renderable)
          : renderable;
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
    let rows = snapshot.rows.filter((row) =>
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
      if (snapshot.status === 'ready') options[dimension] = snapshot.values;
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

  function mainData(
    loaded: Page,
    component: Component,
    snapshotsBySlot: ComponentSnapshots
  ): MainDataSlots {
    const data = componentData(loaded, component, snapshotsBySlot);
    return { main: data.main! };
  }

  function metricData(
    loaded: Page,
    component: Component,
    snapshotsBySlot: ComponentSnapshots
  ): MetricDataSlots {
    const data = componentData(loaded, component, snapshotsBySlot);
    return {
      main: data.main!,
      ...(data.compare ? { compare: data.compare } : {}),
      ...(data.target ? { target: data.target } : {})
    };
  }

</script>

{#snippet renderComponent(component: Component, loaded: Page)}
  {#if component.type === 'reportHeader'}
    <ReportHeader props={component.props} />
  {:else if component.type === 'text'}
    <TextBlock
      props={component.props}
      links={(component.props.links ?? []).map(textLink)}
    />
  {:else if component.type === 'aiSummary'}
    <AiSummaryHost
      props={component.props}
      sourceSnapshots={snapshots}
      config={aiSummary}
    />
  {:else}
    {@const slots = componentSnapshots(component)}
    {@const snapshot = hostSnapshot(component, slots)}
    <WidgetHost {snapshot}>
      {#snippet ready(_readySnapshot)}
        {@const capability = componentCapability(component)}
        {@const chart = isChartComponent(component) ? component : null}
        {@const onclick =
          capability?.actions && chart
            ? ({ row }: { row: Row }) => handleChartClick(chart, row)
            : undefined}
        {#if component.type === 'metricCard'}
          <MetricCard data={metricData(loaded, component, slots)} props={component.props} />
        {:else if component.type === 'barChart'}
          <BarChart
            data={mainData(loaded, component, slots)}
            props={component.props}
            onbarclick={onclick}
          />
        {:else if component.type === 'lineChart'}
          <LineChart
            data={mainData(loaded, component, slots)}
            props={component.props}
            onpointclick={onclick}
          />
        {:else if component.type === 'pieChart'}
          <PieChart
            data={mainData(loaded, component, slots)}
            props={component.props}
            onsliceclick={onclick}
          />
        {:else if component.type === 'rankingCard'}
          <RankingCard data={mainData(loaded, component, slots)} props={component.props} />
        {:else if component.type === 'rankingDetailCard'}
          <RankingDetailCard data={mainData(loaded, component, slots)} props={component.props} />
        {:else if component.type === 'table'}
          <Table
            data={componentData(loaded, component, slots) as NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> }}
            props={component.props}
            interactive={true}
            view={tableViewOf(component)}
            selectedCell={tableSelectedCell(component)}
            filterOptions={tableFilterOptions(component)}
            pagination={tablePaginationState(loaded, component, slots)}
            onpage={(pageIndex) => handleTablePage(component, pageIndex)}
            onpagesize={(pageSize) => handleTablePageSize(component, pageSize)}
            onsort={(sort) => handleTableSort(component, sort)}
            onheaderfilter={(field, value) =>
              handleTableHeaderFilter(component, field, value)}
            oncellselect={({ rowIndex, column }) =>
              handleTableCellSelect(component, rowIndex, column)}
          />
        {:else if component.type === 'mapChart'}
          <MapChart
            data={mainData(loaded, component, slots)}
            props={component.props}
            onregionclick={onclick}
          />
        {/if}
      {/snippet}
    </WidgetHost>
  {/if}
{/snippet}

<div class="runtime-view">
  {#if pageState.phase === 'loading'}
    <p class="muted">加载页面…</p>
  {:else if pageState.phase === 'configuration-error'}
    <div class="error-page">
      <h1>统一运行时接入配置不完整</h1>
      <p><code class="badge">{pageState.error.code}</code></p>
      <p>{pageState.error.message}</p>
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
    <div class="page-content">
    {#if pageState.capabilities.filters && declarations.some((declaration) => declaration.visible !== false)}
      <div class="filter-bar">
        {#each declarations as declaration (declaration.id)}
          {#if declaration.visible !== false}
            {#if declaration.type === 'dimension'}
              <DimensionFilter
                label={declaration.label}
                candidates={dimensionValuesSnapshot(
                  dimensionCandidates,
                  declaration.dimension
                )}
                value={dimensionValue(declaration.id)}
                display={declaration.display ?? 'select'}
                onchange={(values) => writeDimension(declaration, values)}
              />
            {:else}
              <TimeRangeFilter
                label={declaration.label}
                precision={declaration.precision ?? 'date'}
                value={timeRangeValue(declaration.id)}
                onchange={(range) => writeTimeRange(declaration.id, range)}
              />
            {/if}
          {/if}
        {/each}
      </div>
    {/if}

    <div class="page-sections">
      {#each readyPage.sections as section (section.id)}
        <RuntimeSection {section} {authoring}>
          {#snippet componentContent(component: Component)}
            {@render renderComponent(component, readyPage)}
          {/snippet}
        </RuntimeSection>
      {/each}
    </div>
    </div>
  {/if}
</div>

<style>
  .runtime-view {
    --mc-color-canvas: #daeaff;
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
    --mc-section-gradient: url('./assets/section-gradient-panel.svg');

    /* 分区面板外观真源:RuntimeSection(container-panel) 与 ReportHeader 摘要区共用。 */
    --mc-section-panel-padding: 15px 28px 29px;
    --mc-section-panel-background: var(--mc-section-gradient) no-repeat center / 100% 100%;

    /* 分区居中图标标题真源:RuntimeSection、ReportHeader 摘要标题、TextBlock(heading) 共用。 */
    --mc-section-title-gap: 12px;
    --mc-section-title-font-size: 32px;
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
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px;
    padding: 12px 16px;
    margin-bottom: 18px;
    background: var(--mc-color-surface);
    border: 1px solid var(--mc-color-border);
    border-radius: var(--mc-radius-cell);
  }
  .page-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  @media (max-width: 1050px) {
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
