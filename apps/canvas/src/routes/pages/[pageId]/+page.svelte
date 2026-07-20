<script lang="ts">
  import { page } from '$app/state';
  import { goto, replaceState } from '$app/navigation';
  import {
    placeholderDimension,
    validate,
    type ChartWidget,
    type DataSnapshot,
    type FilterDeclaration,
    type Page,
    type Row,
    type TypedError
  } from '@metriccanvas/page';
  import {
    createFilterState,
    drillThroughSearch,
    initialFilterValues,
    orchestrate,
    type FilterState,
    type FilterValues,
    type PageSnapshots
  } from '@metriccanvas/runtime';
  import {
    BarChart,
    DimensionFilter,
    LineChart,
    MetricCard,
    PieChart,
    TimeRangeFilter,
    WidgetHost
  } from '@metriccanvas/widgets';
  import { pageRepository, dataGateway } from '$lib/services';

  type PageState =
    | { phase: 'loading' }
    | { phase: 'missing'; message: string }
    | { phase: 'invalid'; errors: TypedError[] }
    | { phase: 'ready'; page: Page };

  let pageState = $state<PageState>({ phase: 'loading' });
  let snapshots = $state<PageSnapshots>(new Map());
  let filterValues = $state<FilterValues>(new Map());
  /** 维度筛选器候选项(经数据网关实时查询,不入页面文档) */
  let filterOptions = $state<Record<string, string[]>>({});

  let declarations = $state<FilterDeclaration[]>([]);
  let filterState: FilterState | null = null;
  let session = 0;
  let disposers: Array<() => void> = [];

  // 页面生命周期 ②加载 → ③校验 → ④筛选状态初始化(URL 有值则恢复)→ ⑤~⑦编排取数 → ⑧组件渲染
  $effect(() => {
    void run(page.params.pageId!);
    return dispose;
  });

  function dispose() {
    for (const fn of disposers) fn();
    disposers = [];
    filterState = null;
  }

  async function run(pageId: string) {
    const mySession = ++session;
    pageState = { phase: 'loading' };
    snapshots = new Map();
    filterValues = new Map();
    filterOptions = {};

    let raw: unknown;
    try {
      raw = await pageRepository.load(pageId);
    } catch (cause) {
      if (session !== mySession) return;
      pageState = {
        phase: 'missing',
        message: cause instanceof Error ? cause.message : String(cause)
      };
      return;
    }
    if (session !== mySession) return;

    const errors = validate(raw);
    if (errors.length > 0) {
      pageState = { phase: 'invalid', errors };
      return;
    }

    // 文档进、页面出:通过校验后才可视为 Page 聚合(ADR-0007)
    const loaded = raw as Page;
    declarations = loaded.filters ?? [];

    // ④ 筛选状态:按声明的 default 初始化;URL 带筛选参数则整体恢复(可分享还原)
    const fromDeclarations = initialFilterValues(declarations);
    const fromURL = parseFilterURL(location.search, declarations);
    // 逐筛选器合并:URL 有该 id 的值则优先,缺席回落声明的 default——跨页下钻只携带
    // 部分筛选器,目标页其余筛选器的 default 不应被整体作废。已知边界:被清除的
    // 筛选器不入 URL,分享后对方会回落 default(完全还原需显式清除标记,暂不建)。
    const state = createFilterState(new Map([...fromDeclarations, ...fromURL]));
    filterState = state;

    let primed = false;
    disposers.push(
      state.subscribe((values) => {
        filterValues = values;
        // 首推是初值(URL 已一致),之后每次变更同步回 URL,筛选状态可分享
        if (primed) syncURL(state);
        primed = true;
      })
    );

    pageState = { phase: 'ready', page: loaded };
    disposers.push(
      orchestrate(loaded.widgets, dataGateway, state).subscribe((next) => {
        snapshots = next;
      })
    );

    // 维度筛选器候选项:业务数据,永远实时经数据网关查询(ADR-0003:不入页面文档)
    for (const decl of declarations) {
      if (decl.type !== 'dimension') continue;
      void dataGateway.fetchDimensionValues(decl.dimension).then((values) => {
        if (session !== mySession) return;
        filterOptions = { ...filterOptions, [decl.id]: values };
      });
    }
  }

  /**
   * 从 URL 查询串解析筛选状态(借 store 的 fromURL,一处序列化逻辑)。
   * 只保留本页声明的筛选器 id:无关参数不入 store、不被 toURL 回带;
   * URL 只带无关参数时视为"URL 无筛选值",正常回落到声明的 default。
   */
  function parseFilterURL(search: string, declared: FilterDeclaration[]): FilterValues {
    const probe = createFilterState();
    probe.fromURL(search);
    let parsed: FilterValues = new Map();
    probe.subscribe((v) => {
      parsed = v;
    })();
    const ids = new Set(declared.map((decl) => decl.id));
    return new Map([...parsed].filter(([id]) => ids.has(id)));
  }

  /** 筛选状态 → URL:只替换筛选参数,保留无关查询参数 */
  function syncURL(state: FilterState) {
    const params = new URLSearchParams(location.search);
    for (const decl of declarations) params.delete(decl.id);
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

  function writeDimension(decl: Extract<FilterDeclaration, { type: 'dimension' }>, values: string[]) {
    filterState?.write(
      decl.id,
      values.length > 0 ? { type: 'dimension', dimension: decl.dimension, values } : null
    );
  }

  function writeTimeRange(declId: string, range: { from: string; to: string } | null) {
    filterState?.write(declId, range ? { type: 'timeRange', ...range } : null);
  }

  /**
   * ⑨ 按页面 interactions 执行点击事件:回写筛选状态(页内下钻)或跳转目标页(跨页下钻),
   * 组件不感知联动与路由——navigate 由壳执行,组件仍只上抛 {row}(纯渲染原则)。
   */
  function handleChartClick(widget: ChartWidget, row: Row) {
    for (const interaction of widget.interactions ?? []) {
      if (interaction.on !== 'click') continue;
      if ('navigate' in interaction) {
        // 跨页下钻:组装目标页 URL(序列化复用筛选状态的 toURL 编码),目标页生命周期④从 URL 恢复;
        // navigate 命中即终止后续交互(interaction.ts 的顺序语义:离页后回写无意义)
        const search = drillThroughSearch(interaction.navigate, filterValues, row);
        void goto(`/pages/${interaction.navigate.page}${search ? `?${search}` : ''}`);
        return;
      }
      const code = placeholderDimension(interaction.value);
      const clicked = row[code];
      const target = declarations.find((decl) => decl.id === interaction.writeFilter);
      if (clicked == null || target?.type !== 'dimension') continue;
      filterState?.write(interaction.writeFilter, {
        type: 'dimension',
        dimension: target.dimension,
        values: [String(clicked)]
      });
    }
  }
</script>

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
    <p class="muted">修复以下错误后保存,页面会自动刷新。</p>
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
  <h1 class="page-title">{pageState.page.title}</h1>

  {#if declarations.length > 0}
    <div class="filter-bar">
      {#each declarations as decl (decl.id)}
        {#if decl.type === 'dimension'}
          <DimensionFilter
            label={decl.label}
            options={filterOptions[decl.id] ?? []}
            value={dimensionValue(decl.id)}
            display={decl.display ?? 'select'}
            onchange={(values) => writeDimension(decl, values)}
          />
        {:else}
          <TimeRangeFilter
            label={decl.label}
            precision={decl.precision ?? 'date'}
            value={timeRangeValue(decl.id)}
            onchange={(range) => writeTimeRange(decl.id, range)}
          />
        {/if}
      {/each}
    </div>
  {/if}

  <div class="grid" style="grid-template-columns: repeat({pageState.page.layout.columns}, 1fr);">
    {#each pageState.page.widgets as widget (widget.id)}
      {@const snapshot = snapshots.get(widget.id) ?? { status: 'loading' } as DataSnapshot}
      <section
        class="cell"
        style="grid-column: {widget.position.x + 1} / span {widget.position.w};
               grid-row: {widget.position.y + 1} / span {widget.position.h};"
      >
        {#if widget.title}<h2 class="cell-title">{widget.title}</h2>{/if}
        <!-- 快照态(骨架/错误/空)由 WidgetHost 统一呈现,组件只接就绪快照 -->
        <WidgetHost {snapshot}>
          {#snippet ready(readySnapshot)}
            {@const onclick =
              'interactions' in widget && widget.interactions?.length
                ? ({ row }: { row: Row }) => handleChartClick(widget as ChartWidget, row)
                : undefined}
            {#if widget.type === 'metricCard'}
              <MetricCard
                snapshot={readySnapshot}
                config={{ ...widget.display, metric: widget.query.metrics[0] }}
              />
            {:else if widget.type === 'barChart'}
              <BarChart
                snapshot={readySnapshot}
                config={{
                  metrics: widget.query.metrics,
                  dimension: widget.query.dimensions?.[0] ?? '',
                  display: widget.display
                }}
                onbarclick={onclick}
              />
            {:else if widget.type === 'lineChart'}
              <LineChart
                snapshot={readySnapshot}
                config={{
                  metrics: widget.query.metrics,
                  dimension: widget.query.dimensions?.[0] ?? '',
                  display: widget.display
                }}
                onpointclick={onclick}
              />
            {:else if widget.type === 'pieChart'}
              <PieChart
                snapshot={readySnapshot}
                config={{
                  metric: widget.query.metrics[0],
                  dimension: widget.query.dimensions?.[0] ?? '',
                  display: widget.display
                }}
                onsliceclick={onclick}
              />
            {/if}
          {/snippet}
        </WidgetHost>
      </section>
    {/each}
  </div>
{/if}

<style>
  .muted {
    color: #71717a;
  }
  .page-title {
    font-size: 20px;
    margin: 8px 0 20px;
  }
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
  }
  .grid {
    display: grid;
    grid-auto-rows: 72px;
    gap: 16px;
  }
  .cell {
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
  }
  .cell-title {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: #71717a;
  }
  .error-page h1 {
    font-size: 20px;
  }
  .errors {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    font-size: 12px;
    font-weight: 700;
    color: #b91c1c;
  }
  .path {
    font-size: 13px;
    color: #52525b;
  }
</style>
