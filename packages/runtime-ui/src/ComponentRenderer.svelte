<script lang="ts">
  /**
   * 组件分发:页面组件类型 → 纯渲染组件的唯一落点。
   *
   * 从 RuntimeView 抽出,使新增组件只改这一个文件加一个组件实现,
   * 不再与筛选栏、参数水合、表格状态挤在同一份源文件里。
   * 本身零状态:数据槽、宿主态与交互回调全部由统一运行时传入。
   *
   * reportHeader / text / aiSummary / tabContainer 不经 WidgetHost——
   * 它们不声明数据槽,没有加载态与错误态可呈现(见 `rendersWithoutWidgetHost`)。
   */
  import type { Component, DataSnapshot, Row } from '@metriccanvas/page';
  import type { PageDataSnapshots } from '@metriccanvas/runtime';
  import {
    BarChart,
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
  import type { NestedComponentRender, TableRenderBinding } from './component-render';
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

{#if component.type === 'reportHeader'}
  <ReportHeader props={component.props} />
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
    tabs={component.props.tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
    defaultTab={component.props.defaultTab}
  >
    {#snippet children(activeId)}
      {@const child = component.props.tabs.find((tab) => tab.id === activeId)?.component}
      {#if child && nested}
        <Self
          component={child}
          data={nested.data(child)}
          snapshot={nested.snapshot(child)}
          {pageSnapshots}
          {aiSummary}
          table={nested.table(child)}
          onchartclick={nested.onchartclick(child)}
          map={nested.map?.(child)}
          {nested}
        />
      {/if}
    {/snippet}
  </TabContainer>
{:else}
  <WidgetHost {snapshot}>
    {#snippet ready(_readySnapshot)}
      {#if component.type === 'metricCard'}
        <MetricCard data={metricData} props={component.props} />
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
