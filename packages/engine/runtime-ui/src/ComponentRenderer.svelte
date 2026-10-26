<svelte:options css="injected" />
<script lang="ts">
  import { Button } from '@metriccanvas/ui';
  import { PRESENTATION_CONTEXT,type PresentationReader } from './presentation-context';
  /**
   * 组件分发:页面组件类型 → 纯渲染组件的唯一落点。
   *
   * 从 RuntimeView 抽出,使新增组件只改这一个文件加一个组件实现,
   * 不再与筛选栏、参数水合、表格状态挤在同一份源文件里。
   * 本身零状态:数据槽、宿主态与交互回调全部由统一运行时传入。
   *
   * 走不走 WidgetHost 由 `rendersWithoutWidgetHost` 判,模板不再自己列一遍
   * 那几个类型:两处各列一遍时,新增一个纯容器只改了模板、判定函数就落在后面
   * (组合卡这次正是这么漏的)。
   */
  import { getContext, type Snippet } from 'svelte';
  import RuntimeSection from './RuntimeSection.svelte';
  import { TAB_SELECTION_CONTEXT, type TabSelectionContext } from './tab-selection';
  import { selectedTab, tabChildren, type TabContainerComponent } from '@metriccanvas/page/internal';
  const tabSelection = getContext<TabSelectionContext | undefined>(TAB_SELECTION_CONTEXT);
  import { CHART_OPTION_PATHS } from '../../widgets/src/shared/chart-option-extension';
  import ExpandableTable from './table/views/ExpandableTable.svelte';
  import ReportHeaderView from './ReportHeaderView.svelte';
  import { isChartComponent, type Component, type DataSnapshot, type Row } from '@metriccanvas/page/internal';
  import type { PageDataSnapshots } from '../../runtime/src';
  import {
    BarChart,
    CategoryBreakdown,
    CompositeCard,
    FieldText,
    Gauge,
    KeyValuePanel,
    LineChart,
    MapChart,
    MetricCard,
    PieChart,
    RankingCard,
    RankingDetailCard,
    TabContainer,
    Table,
    TextBlock,
    type MainDataSlots,
    type MetricDataSlots,
    type NamedDataSlots,
    type TextBlockLink
  } from '../../widgets/src';
  import { AiSummary, AiSummaryView, exportSummarySnapshot, type AiSummaryConfig } from './ai-summary';
  import { fieldRow } from '../../widgets/src/shared/component-data';
  import WidgetHost from './WidgetHost.svelte';
  import FilterGroup from './dashboard/FilterGroup.svelte';
  import { compositeFilterToolbar } from './dashboard/filter-toolbar';
  import TableToolbar from '../../widgets/src/components/table/TableToolbar.svelte';
  import { componentDataNotices } from './component-render';
  import {
    rendersWithoutWidgetHost,
    type NestedComponentRender,
    type TableRenderBinding
  } from './component-render';
  import Self from './ComponentRenderer.svelte';

  const presentation=getContext<PresentationReader|undefined>(PRESENTATION_CONTEXT);
  const optionPaths = getContext<() => Map<string, string>>(CHART_OPTION_PATHS);

  interface Props {
    component: Component;
    initialTabs?: ReadonlyMap<string, string>;
    summarySnapshot?: import('./ai-summary').AiSummarySnapshot;
    exportMode?: boolean;
    filterGroupReadOnly?: boolean;
    filterGroupValue?: (component: Component) => string | undefined;
    onfiltergroup?: (component: Component, value: string) => void;
    headerControls?: Snippet<[string[]]>;
    headerPeriod?: (component: Extract<Component,{type:"reportHeader"}>) => string | undefined;
    /** 已投影的数据槽:表格的 main 槽已按当前视图状态裁剪。 */
    data: NamedDataSlots;
    /** WidgetHost 呈现的宿主态(加载 / 错误 / 空 / 就绪)。 */
    snapshot: DataSnapshot;
    /** 全页数据快照,只有 AI 总结的关联数据需要。 */
    pageSnapshots: PageDataSnapshots;
    aiSummary?: AiSummaryConfig;
    /** text 组件的跨页链接,已由运行时解析为可点击目标。 */
    textLinks?: TextBlockLink[];
    /** 数据项点击回调;组件不具备 actions 能力时缺席。 */
    onchartclick?: (row: Row) => void;
    /** MetricCard 显式值级链接回调;未声明时缺席。 */
    onmetriclink?: (row: Row, event: MouseEvent) => void;
    metricHref?: (row: Row) => string | undefined;
    /** 项目详情页头的宿主回退接缝。 */
    onback?: () => void;
    table?: TableRenderBinding;
    /** 地图层级下钻后的底图覆盖。 */
    map?: 'china' | 'world';
    nested?: NestedComponentRender;
  }

  let {
    component,
    initialTabs,
    exportMode = false, filterGroupReadOnly = false, filterGroupValue, onfiltergroup, headerControls, headerPeriod, summarySnapshot,
    data,
    snapshot,
    pageSnapshots,
    aiSummary,
    textLinks = [],
    onchartclick,
    onmetriclink,
    metricHref,
    onback,
    table,
    map,
    nested
  }: Props = $props();

  // One failed slot makes the whole component empty, including healthy comparison slots.
  const gate=$derived(presentation?.()?.component(component.id));
  const visibleData = $derived(snapshot.status === 'error'
    ? Object.fromEntries(Object.keys(component.data ?? {}).map(slot => [slot, {
      fields: data[slot]?.fields ?? {}, sourceStatus: 'error' as const, snapshot: { status: 'ready' as const, rows: [] }
    }])) : data);
  const mainData = $derived({ main: visibleData.main! } as MainDataSlots);
  const metricData = $derived({
    main: visibleData.main!,
    ...(visibleData.compare ? { compare: visibleData.compare } : {}),
    ...(visibleData.target ? { target: visibleData.target } : {})
  } as MetricDataSlots);
  const tableData = $derived(
    visibleData as NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> }
  );
</script>

<!-- 容器内的子组件递归回本组件;数据与交互仍由统一运行时按组件提供。 -->
{#snippet child(nestedComponent: Component)}
  {#if nested}
    <Self
      component={nestedComponent}
      {initialTabs}
      {exportMode} {filterGroupReadOnly} {filterGroupValue} {onfiltergroup} {headerControls} {headerPeriod}
      data={nested.data(nestedComponent)}
      snapshot={nested.snapshot(nestedComponent)}
      {pageSnapshots}
      {aiSummary}
      {onback}
      table={nested.table(nestedComponent)}
      onchartclick={nested.onchartclick(nestedComponent)}
      onmetriclink={nested.onmetriclink(nestedComponent)}
      metricHref={nested.metricHref(nestedComponent)}
      map={nested.map?.(nestedComponent)}
      textLinks={nested.textLinks?.(nestedComponent)}
      summarySnapshot={nested.summarySnapshot?.(nestedComponent)}
      {nested}
    />
  {/if}
{/snippet}

{#snippet tabContent(container: TabContainerComponent, tab: TabContainerComponent['props']['tabs'][number])}
  {#if container.props.contentLayout === 'grid'}
    <RuntimeSection contentOnly section={{ id: `${container.id}-${tab.id}`, components: tabChildren(tab) }} componentContent={child} />
  {:else}
    {#each tabChildren(tab) as tabChild (tabChild.id)}{@render child(tabChild)}{/each}
  {/if}
{/snippet}

{#if rendersWithoutWidgetHost(component)}
  {#if component.type === 'filterGroup'}
    <FilterGroup control={component.props} value={filterGroupValue?.(component)}
      label={presentation?.()?.context.declarations.find(filter=>filter.id===component.props.filterId)?.label ?? '筛选'} {exportMode}
      disabled={filterGroupReadOnly || gate?.enabled===false}
      onchange={value => onfiltergroup?.(component, value)} />
  {:else if component.type === 'button'}
    <div data-button-id={component.id}><Button disabled={exportMode||gate?.enabled===false||presentation?.()?.gate(component.props.action).enabled===false}
      onclick={()=>onchartclick?.({})}>{component.props.label}</Button></div>
  {:else if component.type === 'reportHeader'}
    <ReportHeaderView props={component.props} period={headerPeriod?.(component)} controls={headerControls} {onback} {exportMode} />
  {:else if component.type === 'text'}
    <TextBlock props={component.props} links={textLinks} />
  {:else if component.type === 'aiSummary' && exportMode}
    <AiSummaryView props={component.props} data={exportSummarySnapshot(component.props, summarySnapshot)} onretry={()=>{}}/>
  {:else if component.type === 'aiSummary'}
    <AiSummary
      componentId={component.id}
      props={component.props}
      sourceSnapshots={pageSnapshots}
      config={aiSummary}
    />
  {:else if component.type === 'tabContainer' && exportMode}
    <div data-export-tabs>
      {#each component.props.tabs as tab (tab.id)}
        <section data-export-tab={tab.id}><h3>{tab.label}</h3>
          {@render tabContent(component, tab)}
        </section>
      {/each}
    </div>
  {:else if component.type === 'tabContainer'}
    <TabContainer
      title={'title' in component.props ? component.props.title : undefined}
      variant={component.props.variant}
      tabs={component.props.tabs.map((tab) => ({ id: tab.id, label: tab.label,
        contentCount: 'components' in tab ? tab.components.length : 1 }))}
      initialTab={initialTabs?.get(component.id)}
      defaultTab={component.props.defaultTab}
      activeTab={tabSelection ? selectedTab(component, tabSelection.selections()) : undefined}
      onselect={id => tabSelection?.select(component.id, id)}
    >
      {#snippet children(activeId)}
        {@const tab = component.props.tabs.find((candidate) => candidate.id === activeId)}
        {#if tab}
          {@render tabContent(component, tab)}
        {/if}
      {/snippet}
    </TabContainer>
  {:else if component.type === 'compositeCard'}
    <CompositeCard
      toolbar={compositeFilterToolbar(component)}
      title={'title' in component.props ? component.props.title : undefined}
      titleIcon={component.props.titleIcon}
      variant={component.props.variant}
      spans={component.props.components.map((item) => item.layout.span)}
      minHeights={component.props.components.map(item => isChartComponent(item) && !(item.type==='pieChart' && item.props.variant==='compactRing') ? 320 : 0)}
      dividers={component.props.dividers}
    >
      {#snippet children(index)}
        {@const nestedChild = component.props.components[index]}
        {#if nestedChild}{@render child(nestedChild)}{/if}
      {/snippet}
    </CompositeCard>
  {/if}
{:else if component.type === 'table' && component.props.columns.length===0}
  <Table data={tableData} props={component.props} interactive={false} view={{pageIndex:0,sort:[],headerFilters:{}}} />
{:else if component.type === 'table' && table?.expansion && !exportMode}
  <ExpandableTable {component} data={tableData} binding={table} {snapshot} />
{:else}
  {#if component.type === 'table' && table && component.props.toolbar && !exportMode && snapshot.status === 'loading'}
    <TableToolbar toolbar={component.props.toolbar} draft={table.searchDraft} option={table.searchOption} onoption={table.onsearchoption} searchEnabled={table.toolbarEnabled?.search??true} busy={table.exporting}
      error={table.exportError} canExport={false} ondraft={table.onsearchdraft} onsearch={table.onsearch}
      onexport={table.onexport} oncancel={table.oncancelexport} />
  {/if}
  <WidgetHost {snapshot} title={'title' in component.props ? component.props.title : undefined} notices={componentDataNotices(component, snapshot, pageSnapshots, table)}>
    {#snippet ready(_readySnapshot)}
      {#if component.type === 'metricCard'}
        <MetricCard data={metricData} props={component.props} onlink={onmetriclink} linkHref={metricHref} />
      {:else if component.type === 'barChart'}
        <BarChart
          diagnostic={ { componentId: component.id, componentType: component.type, path: optionPaths?.().get(component.id) ?? '/props/echartsOption' } }
          data={mainData}
          props={component.props}
          onbarclick={onchartclick && (({ row }) => onchartclick?.(row))}
        />
      {:else if component.type === 'lineChart'}
        <LineChart
          diagnostic={ { componentId: component.id, componentType: component.type, path: optionPaths?.().get(component.id) ?? '/props/echartsOption' } }
          data={mainData}
          props={component.props}
          onpointclick={onchartclick && (({ row }) => onchartclick?.(row))}
        />
      {:else if component.type === 'pieChart'}
        <PieChart
          diagnostic={ { componentId: component.id, componentType: component.type, path: optionPaths?.().get(component.id) ?? '/props/echartsOption' } }
          data={mainData}
          props={component.props}
          onsliceclick={onchartclick && (({ row }) => onchartclick?.(row))}
        />
      {:else if component.type === 'rankingCard'}
        <RankingCard data={mainData} props={component.props} onrowclick={onchartclick} />
      {:else if component.type === 'rankingDetailCard'}
        <RankingDetailCard data={mainData} props={component.props} />
      {:else if component.type === 'keyValuePanel'}
        <KeyValuePanel data={mainData} props={component.props} />
      {:else if component.type === 'categoryBreakdown'}
        <CategoryBreakdown data={mainData} props={component.props} />
      {:else if component.type === 'fieldText'}
        <FieldText data={mainData} props={component.props} />
      {:else if component.type === 'gauge'}
        {@const gauge = component}
        <Gauge data={mainData} props={component.props} onclick={onchartclick && (() => {
          const row = gauge.props.valueField === undefined ? mainData.main?.snapshot.rows[0] : fieldRow(gauge.props.valueField, mainData);
          if (row) onchartclick?.(row);
          else if (!gauge.data) onchartclick?.({});
        })} />
      {:else if component.type === 'table' && table}
        <Table
          data={tableData}
          props={{ ...component.props, pagination: table.paginationConfig }}
          interactive={!exportMode}
          view={table.view}
          selectedCell={table.selectedCell}
          sortReset={table.sortReset}
          columnCandidates={table.columnCandidates}
          oncandidateopen={table.oncandidateopen}
          oncandidatesearch={table.oncandidatesearch}
          oncandidatemore={table.oncandidatemore}
          oncandidateretry={table.oncandidateretry}
          filterOptions={table.filterOptions}
          filterOptionsStatus={table.filterOptionsStatus}
          pagination={table.pagination}
          searchDraft={table.searchDraft} searchOption={table.searchOption} onsearchoption={table.onsearchoption} exporting={table.exporting} exportError={table.exportError}
          onsearchdraft={table.onsearchdraft} onsearch={table.onsearch} onexport={table.onexport} oncancelexport={table.oncancelexport}
          onpage={table.onpage}
          onpagesize={table.onpagesize}
          onsort={table.onsort}
          onheaderfilter={table.onheaderfilter}
          oncellselect={table.oncellselect}
          onlink={table.onlink}
          interactionGate={table.interactionGate}
          toolbarEnabled={table.toolbarEnabled}
          linkHref={table.linkHref}
        />
      {:else if component.type === 'mapChart'}
        <MapChart
          data={mainData}
          props={component.props}
          {map}
          onregionclick={onchartclick && (({ row }) => onchartclick?.(row))}
        />
      {/if}
    {/snippet}
  </WidgetHost>
{/if}

<style>
  [data-export-tabs] > section { margin-bottom:24px; }
</style>
