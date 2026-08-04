<script lang="ts">
  import {
    dataSourceMode,
    derivePageCapabilities,
    isChartComponent,
    resolveDataSourceFields,
    validate,
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
    createFilterState,
    drillThroughSearch,
    initialFilterValues,
    orchestrate,
    type AuthoringComponentLocator,
    type FilterState,
    type FilterValue,
    type FilterValues,
    type DataGateway,
    type PageDataSnapshots,
    type PageSnapshotStream
  } from '@metriccanvas/runtime';
  import {
    BarChart,
    DimensionFilter,
    LineChart,
    MapChart,
    MetricCard,
    PieChart,
    RankingCard,
    ReportHeader,
    Table,
    TextBlock,
    TimeRangeFilter,
    WidgetHost,
    buildTableColumnLayout,
    initialTableSort,
    shouldApplyTableHeaderFilter,
    type MainDataSlots,
    type MetricDataSlots,
    type NamedDataSlots,
    type TableHeaderFilterValue,
    type TableSelectedCell,
    type TableViewState
  } from '@metriccanvas/widgets';
  import AiSummaryHost from './ai-summary/AiSummaryHost.svelte';
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

  const inlineGateway: DataGateway = {
    async fetchData() {
      throw new Error('inline 看板页面不应访问数据网关');
    },
    async fetchDimensionValues() {
      throw new Error('inline 看板页面不应查询维度候选值');
    }
  };

  let {
    document,
    authoring,
    dataGateway,
    aiSummary,
    initialSearch = '',
    navigation,
    onevent
  }: {
    document: unknown;
    authoring?: AuthoringOptions;
    dataGateway?: DataGateway;
    aiSummary?: AiSummaryConfig;
    initialSearch?: string;
    navigation?: RuntimeNavigation;
    onevent?: (event: RuntimeViewEvent) => void;
  } = $props();

  let pageState = $state<PageState>({ phase: 'loading' });
  let snapshots = $state<PageDataSnapshots>(new Map());
  let filterValues = $state<FilterValues>(new Map());
  let filterOptions = $state<Record<string, string[]>>({});
  let tableViews = $state<Record<string, TableViewState>>({});
  let appliedTableHeaderFilters = $state<
    Record<string, Record<string, TableHeaderFilterValue>>
  >({});
  let headerFilterOptions = $state<Record<string, string[]>>({});
  let activeGateway: DataGateway = inlineGateway;

  let declarations = $state<FilterDeclaration[]>([]);
  let filterState: FilterState | null = null;
  let stream: PageSnapshotStream | null = null;
  let session = 0;
  let dragged = $state<AuthoringComponentLocator | null>(null);
  let disposers: Array<() => void> = [];

  $effect(() => {
    void run(document, dataGateway, initialSearch, navigation, onevent);
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
    gatewayOverride: DataGateway | undefined,
    search: string,
    navigationAdapter: RuntimeNavigation | undefined,
    emit: ((event: RuntimeViewEvent) => void) | undefined
  ) {
    const mySession = ++session;
    pageState = { phase: 'loading' };
    snapshots = new Map();
    filterValues = new Map();
    filterOptions = {};
    tableViews = {};
    appliedTableHeaderFilters = {};
    headerFilterOptions = {};

    // 保持异步初始化接缝，避免外层 effect 把初始化中的状态读取纳入依赖。
    await Promise.resolve();
    if (session !== mySession) return;

    const contractErrors = validate(raw);
    if (contractErrors.length > 0) {
      pageState = { phase: 'invalid', errors: contractErrors };
      emit?.({ type: 'invalid', errors: contractErrors });
      return;
    }

    const loaded = raw as Page;
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
      capabilities.filters ? state : undefined
    );
    stream = pageStream;
    disposers.push(
      pageStream.subscribe((next) => {
        snapshots = next;
      })
    );
    emit?.({ type: 'ready', pageId: loaded.id });

    if (!capabilities.filters) return;

    for (const declaration of declarations) {
      if (declaration.type !== 'dimension') continue;
      void activeGateway.fetchDimensionValues(declaration.dimension).then((values) => {
        if (session !== mySession) return;
        filterOptions = { ...filterOptions, [declaration.id]: values };
      });
    }

    const filterableFields = new Set<string>();
    for (const component of pageComponents(loaded)) {
      if (component.type !== 'table' || !capabilities.components[component.id]?.live) {
        continue;
      }
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
      void activeGateway.fetchDimensionValues(field).then((values) => {
        if (session !== mySession) return;
        headerFilterOptions = { ...headerFilterOptions, [field]: values };
      });
    }
  }

  function configurationIssue(
    mode: ReturnType<typeof dataSourceMode>,
    gatewayValue: unknown
  ): RuntimeConfigurationError | null {
    if (gatewayValue !== undefined && !isDataGateway(gatewayValue)) {
      return configurationError(
        'DATA_GATEWAY_INVALID',
        '数据网关必须实现 fetchData 与 fetchDimensionValues。'
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
        component.props.pagination?.mode !== 'paged'
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

  function fieldName(binding: string | { field: string }): string {
    return typeof binding === 'string' ? binding : binding.field;
  }

  function componentSnapshots(component: Component): ComponentSnapshots {
    return new Map(
      Object.entries(component.data ?? {}).map(([slot, sourceId]) => [
        slot,
        snapshots.get(sourceId) ?? ({ status: 'loading' } as DataSnapshot)
      ])
    );
  }

  function hostSnapshot(component: Component, slots: ComponentSnapshots): DataSnapshot {
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
      if (snapshot.status === 'ready') {
        const visible =
          component.type === 'table' && slot === 'main'
            ? tableSnapshot(component, snapshot)
            : snapshot;
        data[slot] = { snapshot: visible, fields };
      } else if (snapshot.status === 'empty') {
        data[slot] = {
          snapshot: { status: 'ready', rows: [], hasMore: false },
          fields
        };
      }
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
    if (component.props.pagination?.mode !== 'paged') {
      return { status: 'ready', rows, hasMore: false };
    }
    const pageSize = component.props.pagination.pageSize ?? 10;
    const offset = view.pageIndex * pageSize;
    return {
      status: 'ready',
      rows: rows.slice(offset, offset + pageSize),
      hasMore: offset + pageSize < rows.length
    };
  }

  function tableFilterOptions(component: TableComponent): Record<string, string[]> {
    const snapshot = componentSnapshots(component).get('main');
    if (snapshot?.status !== 'ready') return headerFilterOptions;
    const fields = buildTableColumnLayout(component.props.columns).leaves
      .filter((column) => column.filterable?.mode === 'select')
      .map((column) => fieldName(column.field));
    const local = Object.fromEntries(
      fields.map((field) => [
        field,
        [...new Set(snapshot.rows.map((row) => row[field]).filter((value) => value != null).map(String))]
      ])
    );
    return { ...local, ...headerFilterOptions };
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

  function componentCellStyle(component: Component): string {
    return `grid-column: span ${component.layout.span};`;
  }

  function locator(sectionId: string, componentId: string): AuthoringComponentLocator {
    return { sectionId, componentId };
  }

  function selected(sectionId: string, componentId: string): boolean {
    return (
      authoring?.selected?.sectionId === sectionId &&
      authoring.selected.componentId === componentId
    );
  }

  function componentTitleForEditor(component: Component): string {
    return component.props.title ?? '';
  }

  function authoringSelect(event: MouseEvent, sectionId: string, componentId: string) {
    if (!authoring || (event.target as HTMLElement).closest('.authoring-controls')) return;
    event.preventDefault();
    event.stopPropagation();
    authoring.onintent({
      type: 'select_component',
      locator: locator(sectionId, componentId)
    });
  }

  function authoringDragStart(
    event: DragEvent,
    sectionId: string,
    componentId: string
  ) {
    if (!authoring) return;
    dragged = locator(sectionId, componentId);
    event.dataTransfer?.setData(
      'application/x-metriccanvas-component',
      JSON.stringify(dragged)
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function authoringDrop(event: DragEvent, sectionId: string, componentId: string) {
    if (!authoring) return;
    event.preventDefault();
    let source = dragged;
    try {
      const encoded = event.dataTransfer?.getData(
        'application/x-metriccanvas-component'
      );
      if (encoded) source = JSON.parse(encoded) as AuthoringComponentLocator;
    } catch {
      // 拖动会话仍可使用进程内定位。
    }
    const before = locator(sectionId, componentId);
    if (
      source &&
      source.sectionId === before.sectionId &&
      source.componentId !== before.componentId
    ) {
      authoring.onintent({ type: 'move_component', locator: source, before });
    }
    dragged = null;
  }

  function editTitle(
    event: Event,
    sectionId: string,
    component: Component
  ) {
    if (!authoring) return;
    const title = (event.currentTarget as HTMLInputElement).value;
    if (title === componentTitleForEditor(component)) return;
    authoring.onintent({
      type: 'edit_component',
      locator: locator(sectionId, component.id),
      edit: { title }
    });
  }

  function resize(sectionId: string, component: Component, delta: number) {
    authoring?.onintent({
      type: 'edit_component',
      locator: locator(sectionId, component.id),
      edit: { span: Math.min(12, Math.max(1, component.layout.span + delta)) }
    });
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
        {:else if component.type === 'table'}
          <Table
            data={mainData(loaded, component, slots)}
            props={component.props}
            interactive={true}
            view={tableViewOf(component)}
            selectedCell={tableSelectedCell(component)}
            filterOptions={tableFilterOptions(component)}
            onpage={(pageIndex) => handleTablePage(component, pageIndex)}
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

<div
  class:customer-risk-briefing={pageState.phase === 'ready' &&
    pageState.page.id === 'customer-activity-risk-briefing'}
  class="runtime-view"
>
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
    <div class="page-content">
    {#if pageState.capabilities.filters && declarations.some((declaration) => declaration.visible !== false)}
      <div class="filter-bar">
        {#each declarations as declaration (declaration.id)}
          {#if declaration.visible !== false}
            {#if declaration.type === 'dimension'}
              <DimensionFilter
                label={declaration.label}
                options={filterOptions[declaration.id] ?? []}
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
      {#each pageState.page.sections as section (section.id)}
        <section
          class:header-section={section.components.length === 1 &&
            section.components[0]?.type === 'reportHeader'}
          class:titled-section={Boolean(section.title)}
          class:summary-metric-section={section.components.length > 0 &&
            section.components.every(
              (component) => component.type === 'metricCard' && component.props.variant === 'summary'
            )}
          class:activity-metric-section={section.components.length > 0 &&
            section.components.every(
              (component) => component.type === 'metricCard' && component.props.variant === 'activityProgress'
            )}
          class="page-section"
          data-section-id={section.id}
        >
          {#if section.title}<h2 class="section-title">{section.title}</h2>{/if}
          <div
            class="section-grid"
            style="grid-template-columns: repeat({section.layout.columns}, minmax(0, 1fr));"
          >
            {#each section.components as component (component.id)}
              <article
                class:chart-cell={isChartComponent(component)}
                class:header-cell={component.type === 'reportHeader'}
                class:metric-cell={component.type === 'metricCard'}
                class:table-cell={component.type === 'table'}
                class:authoring-cell={Boolean(authoring)}
                class:authoring-selected={selected(section.id, component.id)}
                class="cell"
                data-authoring-component={`${section.id}/${component.id}`}
                style={componentCellStyle(component)}
                draggable={Boolean(authoring)}
                onclickcapture={(event) => authoringSelect(event, section.id, component.id)}
                ondragstart={(event) =>
                  authoringDragStart(event, section.id, component.id)}
                ondragover={(event) => {
                  if (authoring) event.preventDefault();
                }}
                ondrop={(event) => authoringDrop(event, section.id, component.id)}
                ondragend={() => (dragged = null)}
              >
                {#if authoring && selected(section.id, component.id)}
                  <div class="authoring-controls">
                    <span class="authoring-drag" title="拖动组件">⠿</span>
                    <label>
                      <span>画布内标题</span>
                      <input
                        aria-label={`${component.id} 画布内标题`}
                        value={componentTitleForEditor(component)}
                        onchange={(event) => editTitle(event, section.id, component)}
                      />
                    </label>
                    <span class="authoring-span">{component.layout.span}/12</span>
                    <button type="button" aria-label="缩小组件" onclick={() => resize(section.id, component, -1)}>−</button>
                    <button type="button" aria-label="加宽组件" onclick={() => resize(section.id, component, 1)}>＋</button>
                  </div>
                {/if}
                {@render renderComponent(component, pageState.page)}
              </article>
            {/each}
          </div>
        </section>
      {/each}
    </div>
    </div>
  {/if}
</div>

<style>
  .runtime-view {
    width: 100%;
    min-width: 0;
    color: #18181b;
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', sans-serif;
  }
  .runtime-view :global(*) {
    box-sizing: border-box;
  }
  .muted {
    color: #71717a;
  }
  .page-content {
    width: 100%;
    max-width: 75rem;
    box-sizing: border-box;
    margin: 0 auto;
    padding: 28px 18px 54px;
    background: #daeaff;
  }
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px;
    padding: 12px 16px;
    margin-bottom: 18px;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
  }
  .page-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .page-section {
    padding: 18px;
    border: 0;
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 8px 24px rgb(68 85 147 / 0.06);
  }
  .page-section.header-section {
    padding: 0 8px 10px;
    background: transparent;
    box-shadow: none;
  }
  .section-title {
    margin: 0 0 18px;
    color: #08359e;
    font-size: 20px;
    font-weight: 700;
    text-align: left;
  }
  .section-title::before {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 9px;
    border: 3px solid #7d9fff;
    border-radius: 3px 1px 3px 1px;
    content: '';
  }
  .customer-risk-briefing .section-title,
  .customer-risk-briefing .section-title {
    text-align: center;
  }
  .section-grid {
    display: grid;
    align-items: stretch;
    gap: 16px;
  }
  .cell {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 112px;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    overflow: hidden;
    background: #fff;
    border: 1px solid rgb(91 114 234 / 0.12);
    border-radius: 10px;
    box-shadow: 0 8px 22px rgb(53 65 130 / 0.06);
  }
  .metric-cell {
    background: #f1f4ff;
  }
  .authoring-cell {
    cursor: pointer;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .authoring-cell:hover {
    border-color: rgb(79 70 229 / 0.45);
  }
  .authoring-selected {
    z-index: 2;
    overflow: visible;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgb(79 70 229 / 0.18), 0 12px 30px rgb(53 65 130 / 0.14);
  }
  .authoring-controls {
    position: absolute;
    top: -38px;
    right: -1px;
    left: -1px;
    z-index: 20;
    display: flex;
    height: 34px;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    color: #fff;
    background: #3730a3;
    border-radius: 7px;
    box-shadow: 0 8px 20px rgb(49 46 129 / 0.2);
    cursor: default;
  }
  .authoring-drag {
    padding: 0 4px;
    cursor: grab;
  }
  .authoring-controls label {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
  }
  .authoring-controls label span {
    flex: none;
  }
  .authoring-controls input {
    min-width: 80px;
    height: 24px;
    flex: 1;
    padding: 3px 7px;
    color: #27272a;
    background: #fff;
    border: 0;
    border-radius: 4px;
    outline: 0;
    font: inherit;
  }
  .authoring-span {
    flex: none;
    font-size: 10px;
  }
  .authoring-controls button {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    padding: 0;
    color: #3730a3;
    background: #fff;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .chart-cell {
    min-height: 320px;
  }
  .table-cell {
    min-height: 0;
  }
  .header-cell {
    min-height: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  .customer-risk-briefing .page-content {
    max-width: 1200px;
    padding: 35px 19px 48px;
    background: #daeaff;
  }
  .customer-risk-briefing .page-sections {
    gap: 12px;
  }
  .customer-risk-briefing .page-section {
    padding: 0;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
  }
  .customer-risk-briefing .page-section.titled-section {
    padding: 18px 17px 22px 16px;
  }
  .customer-risk-briefing .page-section.header-section,
  .customer-risk-briefing .page-section.activity-metric-section,
  .customer-risk-briefing .page-section.titled-section,
  .customer-risk-briefing .summary-metric-section :global(.metric-card.summary) {
    background-image: url('./assets/customer-risk-section-bg.svg');
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
    border-radius: 16px;
  }
  .customer-risk-briefing .page-section.activity-metric-section {
    padding: 16px 17px 20px;
  }
  .customer-risk-briefing .section-grid {
    gap: 12px 14px;
  }
  .customer-risk-briefing .activity-metric-section .section-grid {
    gap: 12px;
    padding-left: 0;
  }
  .customer-risk-briefing .section-title {
    margin: 0 0 11px;
    color: #08359e;
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
  }
  .customer-risk-briefing .section-title::before {
    display: none;
  }
  .customer-risk-briefing .cell {
    min-height: 0;
    gap: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .customer-risk-briefing .metric-cell {
    background: transparent;
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
    color: #b91c1c;
    font-size: 12px;
    font-weight: 700;
  }
  .path {
    color: #52525b;
    font-size: 13px;
  }
  @media (max-width: 760px) {
    .page-section {
      padding: 16px;
    }
    .cell {
      grid-column: 1 / -1 !important;
    }
  }
</style>
