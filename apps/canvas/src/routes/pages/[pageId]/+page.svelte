<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import {
    derivePageCapabilities,
    isChartComponent,
    validate,
    type ChartComponent,
    type Component,
    type ComponentCapabilities,
    type DataSnapshot,
    type FilterDeclaration,
    type Page,
    type Row,
    type TableComponent,
    type TextLink,
    type TypedError
  } from '@metriccanvas/page';
  import {
    DEFAULT_TABLE_PAGE_SIZE,
    createFilterState,
    drillThroughSearch,
    initialFilterValues,
    orchestrate,
    type AuthoringComponentLocator,
    type AuthoringIntent,
    type ComponentSnapshots,
    type FilterState,
    type FilterValues,
    type PageSnapshots,
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
    tableHeaderFilterConditions,
    type MainDataSlots,
    type MetricDataSlots,
    type NamedDataSlots,
    type TableHeaderFilterValue,
    type TableViewState
  } from '@metriccanvas/widgets';
  import { catalogSnapshot, dataGateway, pageRepository } from '$lib/services';

  type PageCapabilities = ReturnType<typeof derivePageCapabilities>;
  type PageState =
    | { phase: 'loading' }
    | { phase: 'missing'; message: string }
    | { phase: 'invalid'; errors: TypedError[] }
    | { phase: 'ready'; page: Page; capabilities: PageCapabilities };

  interface AuthoringOptions {
    selected?: AuthoringComponentLocator;
    onintent(intent: AuthoringIntent): void;
  }

  let { document, authoring }: { document?: unknown; authoring?: AuthoringOptions } = $props();

  let pageState = $state<PageState>({ phase: 'loading' });
  let snapshots = $state<PageSnapshots>(new Map());
  let filterValues = $state<FilterValues>(new Map());
  let filterOptions = $state<Record<string, string[]>>({});
  let tableViews = $state<Record<string, TableViewState>>({});
  let appliedTableHeaderFilters = $state<
    Record<string, Record<string, TableHeaderFilterValue>>
  >({});
  let headerFilterOptions = $state<Record<string, string[]>>({});

  let declarations = $state<FilterDeclaration[]>([]);
  let filterState: FilterState | null = null;
  let stream: PageSnapshotStream | null = null;
  let session = 0;
  let dragged = $state<AuthoringComponentLocator | null>(null);
  let disposers: Array<() => void> = [];

  $effect(() => {
    const injected = document;
    const pageId = injected === undefined ? page.params.pageId! : undefined;
    void run(injected, pageId);
    return dispose;
  });

  function dispose() {
    for (const fn of disposers) fn();
    disposers = [];
    filterState = null;
    stream = null;
  }

  async function run(injected: unknown | undefined, pageId: string | undefined) {
    const mySession = ++session;
    pageState = { phase: 'loading' };
    snapshots = new Map();
    filterValues = new Map();
    filterOptions = {};
    tableViews = {};
    appliedTableHeaderFilters = {};
    headerFilterOptions = {};

    let raw: unknown;
    if (injected === undefined) {
      try {
        raw = await pageRepository.load(pageId!);
      } catch (cause) {
        if (session !== mySession) return;
        pageState = {
          phase: 'missing',
          message: cause instanceof Error ? cause.message : String(cause)
        };
        return;
      }
      if (session !== mySession) return;
    } else {
      raw = injected;
      // 与仓库加载路径保持同一异步边界，避免运行时初始化中的状态读取
      // 被外层 $effect 追踪，形成重复初始化循环。
      await Promise.resolve();
      if (session !== mySession) return;
    }

    const errors = validate(raw, catalogSnapshot);
    if (errors.length > 0) {
      pageState = { phase: 'invalid', errors };
      return;
    }

    const loaded = raw as Page;
    const capabilities = derivePageCapabilities(loaded);
    declarations = loaded.filters ?? [];

    const fromDeclarations = initialFilterValues(declarations);
    const fromURL: FilterValues = capabilities.filters
      ? parseFilterURL(location.search, declarations)
      : new Map();
    const state = createFilterState(new Map([...fromDeclarations, ...fromURL]));
    filterState = state;

    let primed = false;
    disposers.push(
      state.subscribe((values) => {
        const previous = filterValues;
        filterValues = values;
        if (primed && capabilities.filters) {
          syncURL(state);
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
        sort: initialTableSort(
          source?.source.type === 'query' ? source.source.query.orderBy : undefined
        ),
        headerFilters: {}
      };
    }
    tableViews = initialViews;
    pageState = { phase: 'ready', page: loaded, capabilities };

    const pageStream = orchestrate(loaded, dataGateway, capabilities.filters ? state : undefined);
    stream = pageStream;
    disposers.push(
      pageStream.subscribe((next) => {
        snapshots = next;
      })
    );

    if (!capabilities.filters) return;

    for (const declaration of declarations) {
      if (declaration.type !== 'dimension') continue;
      void dataGateway.fetchDimensionValues(declaration.dimension).then((values) => {
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
        source?.fields
      ).leaves) {
        if (column.filterable?.mode === 'select') {
          filterableFields.add(fieldName(column.field));
        }
      }
    }
    for (const field of filterableFields) {
      void dataGateway.fetchDimensionValues(field).then((values) => {
        if (session !== mySession) return;
        headerFilterOptions = { ...headerFilterOptions, [field]: values };
      });
    }
  }

  function pageComponents(loaded: Page): Component[] {
    return loaded.sections.flatMap((section) => section.components);
  }

  function componentCapability(component: Component): ComponentCapabilities | undefined {
    return pageState.phase === 'ready'
      ? pageState.capabilities.components[component.id]
      : undefined;
  }

  function pageSizeOf(component: TableComponent): number {
    return component.props.pagination?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
  }

  function tableIsPaged(component: TableComponent): boolean {
    return component.props.pagination?.mode === 'paged';
  }

  function setTableView(component: TableComponent, next: TableViewState) {
    tableViews = { ...tableViews, [component.id]: next };
  }

  function appliedHeaderFiltersOf(
    component: TableComponent
  ): Record<string, TableHeaderFilterValue> {
    return appliedTableHeaderFilters[component.id] ?? {};
  }

  function writeTableQuery(
    component: TableComponent,
    next: TableViewState,
    headerFilters = appliedHeaderFiltersOf(component)
  ) {
    stream?.setView(component.id, {
      ...(tableIsPaged(component)
        ? {
            limit: pageSizeOf(component),
            offset: next.pageIndex * pageSizeOf(component)
          }
        : {}),
      orderBy: next.sort,
      conditions: tableHeaderFilterConditions(headerFilters)
    });
  }

  function pushTableView(component: TableComponent, next: TableViewState) {
    if (!componentCapability(component)?.live) return;
    setTableView(component, next);
    writeTableQuery(component, next);
  }

  function tableViewOf(component: TableComponent): TableViewState {
    return tableViews[component.id] ?? { pageIndex: 0, sort: [], headerFilters: {} };
  }

  function handleTablePage(component: TableComponent, pageIndex: number) {
    if (!componentCapability(component)?.remotePagination) return;
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
    if (!componentCapability(component)?.live) return;
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
    writeTableQuery(component, next, applied);
  }

  function resetTablePages(loaded: Page, previous: FilterValues, next: FilterValues) {
    const changed = new Set<string>();
    for (const id of new Set([...previous.keys(), ...next.keys()])) {
      if (JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id))) changed.add(id);
    }
    for (const component of pageComponents(loaded)) {
      if (
        component.type !== 'table' ||
        !componentCapability(component)?.remotePagination
      ) {
        continue;
      }
      const view = tableViewOf(component);
      if (view.pageIndex === 0) continue;
      const source = loaded.dataSources[component.data.main];
      const subscriptions =
        source?.source.type === 'query'
          ? (source.source.query.filters?.subscribe ?? [])
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

  function syncURL(state: FilterState) {
    const params = new URLSearchParams(location.search);
    for (const declaration of declarations) params.delete(declaration.id);
    for (const [key, value] of new URLSearchParams(state.toURL())) params.set(key, value);
    const query = params.toString();
    replaceState(`${location.pathname}${query ? `?${query}` : ''}`, {});
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
        void goto(`/pages/${action.navigate.page}${search ? `?${search}` : ''}`);
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

  function textLinkHref(link: TextLink): string {
    const search = drillThroughSearch(
      { page: link.page, carryFilters: link.carryFilters },
      filterValues,
      {}
    );
    return `/pages/${link.page}${search ? `?${search}` : ''}`;
  }

  function fieldName(binding: string | { field: string }): string {
    return typeof binding === 'string' ? binding : binding.field;
  }

  function componentSnapshots(component: Component): ComponentSnapshots {
    const current = snapshots.get(component.id);
    if (current) return current;
    return new Map(
      Object.keys(component.data ?? {}).map((slot) => [
        slot,
        { status: 'loading' } as DataSnapshot
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
      if (snapshot.status === 'ready') {
        data[slot] = { snapshot, fields: source.fields };
      } else if (snapshot.status === 'empty') {
        data[slot] = {
          snapshot: { status: 'ready', rows: [], hasMore: false },
          fields: source.fields
        };
      }
    }
    return data;
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
    return component.type === 'text'
      ? component.props.heading ?? ''
      : component.props.title ?? '';
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
      links={(component.props.links ?? []).map((link) => ({
        label: link.label,
        href: textLinkHref(link)
      }))}
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
            interactive={capability?.live ?? false}
            view={tableViewOf(component)}
            filterOptions={headerFilterOptions}
            onpage={(pageIndex) => handleTablePage(component, pageIndex)}
            onsort={(sort) => handleTableSort(component, sort)}
            onheaderfilter={(field, value) =>
              handleTableHeaderFilter(component, field, value)}
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

{#if pageState.phase === 'loading'}
  <p class="muted">加载页面…</p>
{:else if pageState.phase === 'missing'}
  <div class="error-page">
    <h1>页面加载失败</h1>
    <p>{pageState.message}</p>
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
    {#if pageState.capabilities.filters && declarations.length > 0}
      <div class="filter-bar">
        {#each declarations as declaration (declaration.id)}
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
        {/each}
      </div>
    {/if}

    <div class="page-sections">
      {#each pageState.page.sections as section (section.id)}
        <section class="page-section">
          {#if section.title}<h2 class="section-title">{section.title}</h2>{/if}
          <div
            class="section-grid"
            style="grid-template-columns: repeat({section.layout.columns}, minmax(0, 1fr));"
          >
            {#each section.components as component (component.id)}
              <article
                class:chart-cell={isChartComponent(component)}
                class:header-cell={component.type === 'reportHeader'}
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

<style>
  .muted {
    color: #71717a;
  }
  .page-content {
    width: 100%;
    max-width: 1162px;
    margin: 0 auto;
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
    gap: 22px;
  }
  .page-section {
    padding: 22px;
    border: 1px solid rgb(112 130 220 / 0.14);
    border-radius: 22px;
    background: linear-gradient(135deg, #edf4ff 0%, #f2efff 54%, #f8f4ff 100%);
  }
  .section-title {
    margin: 0 0 18px;
    color: #24356f;
    font-size: 18px;
    font-weight: 650;
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
    min-height: 380px;
  }
  .header-cell {
    min-height: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    border: 0;
    box-shadow: none;
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
