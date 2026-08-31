<script lang="ts">
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
  import type { Component, DataSnapshot, Row } from '@metriccanvas/page';
  import type { PageDataSnapshots } from '@metriccanvas/runtime';
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
    ReportHeader,
    TabContainer,
    Table,
    TextBlock,
    type MainDataSlots,
    type MetricDataSlots,
    type NamedDataSlots,
    type TextBlockLink
  } from '@metriccanvas/widgets';
  import AiSummaryHost from './ai-summary/AiSummaryHost.svelte';
  import type { AiSummaryConfig } from './ai-summary/pangu-sse';
  import WidgetHost from './WidgetHost.svelte';
  import {
    rendersWithoutWidgetHost,
    type NestedComponentRender,
    type TableRenderBinding
  } from './component-render';
  import Self from './ComponentRenderer.svelte';

  interface Props {
    component: Component;
    /** 已投影的数据槽:表格的 main 槽已按当前视图状态裁剪。 */
    data: NamedDataSlots;
    /** WidgetHost 呈现的宿主态(加载 / 错误 / 空 / 就绪)。 */
    snapshot: DataSnapshot;
    /** 全页数据快照,只有 AI 总结的关联数据需要。 */
    pageSnapshots: PageDataSnapshots;
    aiSummary?: AiSummaryConfig;
    /** text 组件的跨页链接,已由运行时解析为可点击目标。 */
    textLinks?: TextBlockLink[];
    /** 图表点击回调;组件不具备 actions 能力时缺席。 */
    onchartclick?: (row: Row) => void;
    /** MetricCard 显式值级链接回调;未声明时缺席。 */
    onmetriclink?: (row: Row) => void;
    /** 项目详情页头的宿主回退接缝。 */
    onback?: () => void;
    table?: TableRenderBinding;
    /** 地图层级下钻后的底图覆盖。 */
    map?: 'china' | 'world';
    nested?: NestedComponentRender;
  }

  let {
    component,
    data,
    snapshot,
    pageSnapshots,
    aiSummary,
    textLinks = [],
    onchartclick,
    onmetriclink,
    onback,
    table,
    map,
    nested
  }: Props = $props();

  const mainData = $derived({ main: data.main! } as MainDataSlots);
  const metricData = $derived({
    main: data.main!,
    ...(data.compare ? { compare: data.compare } : {}),
    ...(data.target ? { target: data.target } : {})
  } as MetricDataSlots);
  const tableData = $derived(
    data as NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> }
  );
</script>

<!-- 容器内的子组件递归回本组件;数据与交互仍由统一运行时按组件提供。 -->
{#snippet child(nestedComponent: Component)}
  {#if nested}
    <Self
      component={nestedComponent}
      data={nested.data(nestedComponent)}
      snapshot={nested.snapshot(nestedComponent)}
      {pageSnapshots}
      {aiSummary}
      {onback}
      table={nested.table(nestedComponent)}
      onchartclick={nested.onchartclick(nestedComponent)}
      onmetriclink={nested.onmetriclink(nestedComponent)}
      map={nested.map?.(nestedComponent)}
      {nested}
    />
  {/if}
{/snippet}

{#if rendersWithoutWidgetHost(component)}
  {#if component.type === 'reportHeader'}
    <ReportHeader props={component.props} {onback} />
  {:else if component.type === 'text'}
    <TextBlock props={component.props} links={textLinks} />
  {:else if component.type === 'aiSummary'}
    <AiSummaryHost
      props={component.props}
      sourceSnapshots={pageSnapshots}
      config={aiSummary}
    />
  {:else if component.type === 'tabContainer'}
    <TabContainer
      title={component.props.title}
      variant={component.props.variant}
      tabs={component.props.tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
      defaultTab={component.props.defaultTab}
    >
      {#snippet children(activeId)}
        {@const tab = component.props.tabs.find((candidate) => candidate.id === activeId)}
        {#if tab}
          {#each 'components' in tab ? tab.components : [tab.component] as tabChild (tabChild.id)}
            {@render child(tabChild)}
          {/each}
        {/if}
      {/snippet}
    </TabContainer>
  {:else if component.type === 'compositeCard'}
    <CompositeCard
      title={component.props.title}
      titleIcon={component.props.titleIcon}
      variant={component.props.variant}
      spans={component.props.components.map((item) => item.layout.span)}
      dividers={component.props.dividers}
    >
      {#snippet children(index)}
        {@const nestedChild = component.props.components[index]}
        {#if nestedChild}{@render child(nestedChild)}{/if}
      {/snippet}
    </CompositeCard>
  {/if}
{:else}
  <WidgetHost {snapshot}>
    {#snippet ready(_readySnapshot)}
      {#if component.type === 'metricCard'}
        <MetricCard data={metricData} props={component.props} onlink={onmetriclink} />
      {:else if component.type === 'barChart'}
        <BarChart
          data={mainData}
          props={component.props}
          onbarclick={onchartclick && (({ row }) => onchartclick?.(row))}
        />
      {:else if component.type === 'lineChart'}
        <LineChart
          data={mainData}
          props={component.props}
          onpointclick={onchartclick && (({ row }) => onchartclick?.(row))}
        />
      {:else if component.type === 'pieChart'}
        <PieChart
          data={mainData}
          props={component.props}
          onsliceclick={onchartclick && (({ row }) => onchartclick?.(row))}
        />
      {:else if component.type === 'rankingCard'}
        <RankingCard data={mainData} props={component.props} />
      {:else if component.type === 'rankingDetailCard'}
        <RankingDetailCard data={mainData} props={component.props} />
      {:else if component.type === 'keyValuePanel'}
        <KeyValuePanel data={mainData} props={component.props} />
      {:else if component.type === 'categoryBreakdown'}
        <CategoryBreakdown data={mainData} props={component.props} />
      {:else if component.type === 'fieldText'}
        <FieldText data={mainData} props={component.props} />
      {:else if component.type === 'gauge'}
        <Gauge data={mainData} props={component.props} />
      {:else if component.type === 'table' && table}
        <Table
          data={tableData}
          props={component.props}
          interactive={true}
          view={table.view}
          selectedCell={table.selectedCell}
          filterOptions={table.filterOptions}
          pagination={table.pagination}
          onpage={table.onpage}
          onpagesize={table.onpagesize}
          onsort={table.onsort}
          onheaderfilter={table.onheaderfilter}
          oncellselect={table.oncellselect}
          onlink={table.onlink}
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
