<svelte:options css="injected" />
<script lang="ts" module>
  export type { TableHeaderFilterValue, TableViewState, TablePaginationState, TableSelectedCell } from './view-state';
</script>

<script lang="ts">
  import { getContext } from 'svelte';
  import { columnBindingKey } from '@metriccanvas/page/internal';
  import { Empty } from '@metriccanvas/ui';
  import { STATIC_EXPORT_CONTEXT } from '../../shared/export-context';
  import { readPixelLength } from '../../shared/inherited-style';
  import { TABLE_EXPAND_CONTEXT, type TableExpandControl } from '../../shared/table-expand-context';
  import { visibleAfterPaint } from '../../shared/visible-after-paint';
  import { buildTableColumnLayout, shouldWrapTableHeaders } from './columns';
  import TableExpandButton from './header/TableExpandButton.svelte';
  import TableHeading from './header/TableHeading.svelte';
  import { mergeSpans, tableRowTier } from './presentation';
  import { projectTableRows } from './rows';
  import TableBody from './TableBody.svelte';
  import TableHeader from './TableHeader.svelte';
  import TablePagination from './TablePagination.svelte';
  import TableToolbar from './TableToolbar.svelte';
  import TableWarnings from './TableWarnings.svelte';
  import { tableGeometry } from './table-geometry';
  import {
    computeColumnWidthTotal,
    computeFitMinWidth,
    computeRateBarMaxima,
    computeStickyOffsets,
    computeValidExpansionKeys,
    formatColumnWidthStyle
  } from './table-layout';
  import type { TableHeaderFilterSource, TableWidgetProps } from './table-types';
  import type { TablePaginationState } from './view-state';
  import { tableDataWarnings } from './warnings';

  const staticExport = Boolean(getContext(STATIC_EXPORT_CONTEXT));

  /**
   * 表格(纯渲染):行与列定义 props 进,翻页/排序/表头筛选事件出,自身零状态。
   * 常规表格使用固定表头 + 表体滚动;reportCompact 使用无边框内容层且不设滚动层;
   * 固定列(left/right)以 sticky 实现;
   * 排序状态显示在列头(多列时带优先级序号);分页由壳传入页大小与总条数。
   */
  let {
    data,
    props,
    nested = false,
    expansion,
    expandedRow,
    interactive = true,
    view,
    columnCandidates,
    oncandidatepreloadvisible,
    oncandidateopen,
    oncandidatesearch,
    oncandidatemore,
    oncandidateretry,
    filterOptions = {},
    filterOptionsStatus = {},
    pagination: currentPagination,
    searchDraft,
    searchOption,
    onsearchoption,
    exporting,
    exportError,
    onsearchdraft,
    onsearch,
    onexport,
    oncancelexport,
    selectedCell,
    onpage,
    onemptyretry,
    onpagesize,
    onsort,
    sortReset,
    onheaderfilter,
    oncellselect,
    onlink,
    interactionGate,
    toolbarEnabled,
    linkHref
  }: TableWidgetProps = $props();

  const subtitle = $derived(props.subtitle);
  const loading = $derived(data.main.sourceStatus === 'loading');
  const bodyLoading = $derived(loading && !data.main.progress && !staticExport);
  let previousPagination = $state.raw<TablePaginationState>();
  const pagination = $derived(
    loading && !data.main.progress
      ? (previousPagination ??
          currentPagination ?? {
            pageSize: props.pagination?.mode === 'local' ? props.pagination.pageSize : 20,
            totalCount: 0
          })
      : currentPagination
  );
  $effect(() => {
    if (!loading) previousPagination = currentPagination;
  });

  const expandable = $derived(Boolean(expansion && interactive && !staticExport));
  const validExpansionKeys = $derived(computeValidExpansionKeys(data.main.snapshot.rows, expansion?.key));
  const rowNumberWidth = $derived(props.rowNumber ? (props.rowNumber.width ?? 64) : 0);
  const leadingColumnCount = $derived((expandable ? 1 : 0) + (props.rowNumber ? 1 : 0));
  const rowNumberOffset = $derived(staticExport ? 0 : view.pageIndex * (pagination?.pageSize ?? 0));
  const rowNumberStyle = $derived(props.rowNumber?.fixed ? `position: sticky; left: ${expandable ? 40 : 0}px;` : '');
  const columnLayout = $derived(buildTableColumnLayout(props.columns, data.main.fields));
  const leaves = $derived(columnLayout.leaves);
  const wrapHeaders = $derived(shouldWrapTableHeaders(props.fit, leaves.length));
  const rows = $derived(
    projectTableRows(data, props, {
      showPinned: !view.searchQuery,
      showPendingPinned: !staticExport,
      showBody: !bodyLoading
    })
  );
  const rowTiers = $derived(rows.map((row) => tableRowTier(row, props.rowKindField)));
  /** 首列合并:相邻同值折成一个单元格,rowSpan 为 0 的行不渲染该列。 */
  const rowSpans = $derived(mergeSpans(rows, props.mergeBy));
  const mergedColumnField = $derived(props.mergeBy);
  const columnWidthTotal = $derived(computeColumnWidthTotal(leaves, rowNumberWidth, expandable));
  const fitMinWidth = $derived(computeFitMinWidth(leaves, columnWidthTotal, rowNumberWidth, Boolean(props.rowNumber)));
  const stickyOffsets = $derived(
    computeStickyOffsets(leaves, expandable, Boolean(props.rowNumber?.fixed), rowNumberWidth)
  );
  const rateBarMaxima = $derived(computeRateBarMaxima(leaves, rows, data));

  /**
   * 表头行高唯一真源:多行粘性表头的 top 偏移与 CSS 行高共用同一数值,
   * 经根元素 CSS 变量下发,JS 与样式不再各写一份(修复默认档 40/42 错位)。
   */
  let root = $state<HTMLElement | null>(null);
  const sectionExpansion = getContext<TableExpandControl | undefined>(TABLE_EXPAND_CONTEXT);
  const showSectionExpansion = $derived(
    Boolean(props.expand && root && !staticExport && sectionExpansion?.available(root))
  );

  function toggleSectionExpansion(): void {
    if (root) sectionExpansion?.toggle(root);
  }

  const variantHeaderRowHeight = $derived(
    props.variant === 'forecastMatrix' ? 32 : props.variant === 'reportCompact' ? 33 : 42
  );
  const headerRowHeight = $derived(
    props.variant !== 'reportCompact'
      ? 40
      : (readPixelLength(root, '--mc-table-header-row-height') ?? variantHeaderRowHeight)
  );
  const preloadHandler = $derived(
    interactive &&
      !staticExport &&
      (data.main.snapshot.status === 'ready' || data.main.snapshot.status === 'empty')
      ? oncandidatepreloadvisible
      : undefined
  );
  const filterSource = $derived<TableHeaderFilterSource>({
    columnCandidates,
    filterOptions,
    filterOptionsStatus,
    oncandidateopen,
    oncandidatesearch,
    oncandidatemore,
    oncandidateretry,
    onheaderfilter
  });
</script>

<div
  bind:this={root}
  use:visibleAfterPaint={preloadHandler}
  use:tableGeometry={!staticExport && leaves.length > 0}
  class:os-theme={props.variant !== 'reportCompact'}
  class:fit-container={props.fit === 'container'}
  class:row-content={nested}
  class:wrap-headers={wrapHeaders}
  class:report-compact={props.variant === 'reportCompact'}
  class:embedded={props.variant === 'embedded'}
  class:forecast-matrix={props.variant === 'forecastMatrix'}
  class:compound-inline={props.compoundCellLayout === 'inline'}
  class:fixed-height={!staticExport && props.height !== undefined}
  class:static-export={staticExport}
  class="table-widget"
  aria-busy={data.main.sourceStatus === 'loading'}
  data-table-title={props.title}
  style:--table-frame-height={props.height === undefined ? undefined : `${props.height}px`}
  style:--table-header-row-height={`${headerRowHeight}px`}
  style:--table-content-min-width={`${columnWidthTotal}px`}
  style:--table-fit-min-width={`${fitMinWidth}px`}
>
  {#snippet sectionExpandAction()}
    <TableExpandButton expanded={root ? (sectionExpansion?.expanded(root) ?? false) : false} onclick={toggleSectionExpansion} />
  {/snippet}
  <TableHeading
    title={props.title}
    {subtitle}
    showTools={interactive && !staticExport && Boolean(props.toolbar) && leaves.length > 0}
    trailingAction={showSectionExpansion ? sectionExpandAction : undefined}
  >
    {#snippet tools()}
      {#if interactive && !staticExport && props.toolbar}
        <TableToolbar
          toolbar={props.toolbar}
          searchEnabled={toolbarEnabled?.search ?? true}
          canExport={(toolbarEnabled?.export ?? true) && data.main.sourceStatus !== 'loading' && !data.main.progress}
          option={searchOption}
          onoption={onsearchoption}
          draft={searchDraft}
          busy={exporting}
          error={exportError}
          ondraft={onsearchdraft}
          {onsearch}
          {onexport}
          oncancel={oncancelexport}
        />
      {/if}
    {/snippet}
  </TableHeading>
  <TableWarnings warnings={tableDataWarnings(data)} />
  {#if view?.operationNotice}<p role="status">{view.operationNotice}</p>{/if}
  {#if leaves.length === 0}
    <Empty message="当前条件下无可见列" />
  {:else}
    <div
      class:content-frame={props.variant === 'reportCompact'}
      class:section-expand-scroll={showSectionExpansion}
      class="scroll"
    >
      <table>
        <colgroup>
          {#if expandable}<col style="width:40px;min-width:40px" />{/if}
          {#if props.rowNumber}
            <col
              style={props.fit === 'container'
                ? `width: ${(rowNumberWidth / columnWidthTotal) * 100}%;`
                : `width: ${rowNumberWidth}px; min-width: ${rowNumberWidth}px;`}
            />
          {/if}
          {#each leaves as column (columnBindingKey(column.field))}
            <col style={formatColumnWidthStyle(column, props.fit, columnWidthTotal)} />
          {/each}
        </colgroup>
        <TableHeader
          {data}
          {props}
          {columnLayout}
          {leaves}
          {expandable}
          {leadingColumnCount}
          {rowNumberStyle}
          {headerRowHeight}
          {stickyOffsets}
          {interactive}
          {wrapHeaders}
          {staticExport}
          {view}
          {sortReset}
          {filterSource}
          {onsort}
        />
        <TableBody
          {data}
          {props}
          {leaves}
          {rows}
          {rowTiers}
          {rowSpans}
          {mergedColumnField}
          {expandable}
          {expansion}
          {expandedRow}
          {validExpansionKeys}
          {leadingColumnCount}
          {rowNumberOffset}
          {rowNumberStyle}
          {stickyOffsets}
          {rateBarMaxima}
          {loading}
          {bodyLoading}
          {interactive}
          {staticExport}
          {selectedCell}
          {interactionGate}
          {linkHref}
          {oncellselect}
          {onlink}
          {onemptyretry}
        />
      </table>
    </div>

    {#if props.bottomFade}
      <div class="bottom-fade" aria-hidden="true"></div>
    {/if}

    {#if props.pagination && props.pagination.mode !== 'none' && interactive && pagination}
      <TablePagination
        {pagination}
        pageIndex={view.pageIndex}
        {loading}
        hasProgress={Boolean(data.main.progress)}
        osTheme={props.variant !== 'reportCompact'}
        {onpage}
        {onpagesize}
      />
    {/if}
  {/if}
</div>

<style>
  .table-widget {
    position: relative;
    box-sizing: border-box;
    flex: 1;
    width: 100%;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: var(--mc-table-padding-top, 19px) var(--mc-table-padding-inline, 19px) 11px;
    background: var(--mc-color-surface, #fff);
    border-radius:
      var(--table-widget-radius-top-left, 16px)
      var(--table-widget-radius-top-right, 16px)
      var(--table-widget-radius-bottom-right, 16px)
      var(--table-widget-radius-bottom-left, 16px);
    font-size: 14px;
  }
  .embedded {
    box-sizing: border-box;
    width: 100%;
    height: 448px;
    flex: none;
    padding: 0;
    background: transparent;
    border-radius: 0;
    font-size: 14px;
  }
  .embedded > .scroll {
    box-sizing: border-box;
    width: 100%;
    height: 448px;
    flex: none;
    overflow: auto;
    border: 0;
  }
  /* 固定表头 + 表体滚动:thead sticky,滚动发生在容器上(纵横双向) */
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid #e8ebf3;
    border-radius: 0;
  }
  .scroll.section-expand-scroll {
    overscroll-behavior-x: none;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: auto;
  }
  .bottom-fade {
    position: absolute;
    z-index: 5;
    right: 0;
    bottom: -18px;
    left: 0;
    width: auto;
    height: 25px;
    border-radius: 0 0 16px 16px;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.32));
    pointer-events: none;
  }
  .table-widget.report-compact {
    padding: 0;
    background: transparent;
    border-radius: 0;
    font-size: 14px;
  }
  .report-compact > :global(.table-heading) {
    min-height: 30px;
    margin-bottom: 8px;
  }
  .report-compact :global(.table-heading h3) {
    font-size: var(--mc-font-size-report-level-4, 18px);
    font-weight: 400;
    line-height: 30px;
  }
  .report-compact > .content-frame {
    box-sizing: border-box;
    padding: 0;
    overflow: visible;
    background: var(--mc-color-report-content-surface, #fcfcff);
    border-radius: var(--mc-radius-report-content, 12px);
  }
  .report-compact > .content-frame table {
    border-radius: 0;
  }
  .fit-container > .scroll {
    overflow-x: auto;
  }
  .fit-container > :where(.scroll,.content-frame) > table {
    table-layout: fixed;
    min-width: var(--table-fit-min-width);
  }
  .table-widget.forecast-matrix {
    --mc-table-header-row-height: 32px;

    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 770px;
    flex: none;
    gap: 4px;
    padding: 22px clamp(16px, 2cqi, 22px) 17px clamp(16px, 2.4cqi, 26px);
    overflow: hidden;
    background: #fff;
    border-radius: 16px;
    font-size: 14px;
  }
  .forecast-matrix > :global(.table-heading) {
    min-height: 24px;
    flex: 0 0 24px;
    margin: 0;
  }
  .forecast-matrix > :global(.table-heading h3) {
    color: #191919;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
  .forecast-matrix > .scroll {
    box-sizing: border-box;
    width: 100%;
    height: 703px;
    min-height: 703px;
    flex: 0 0 703px;
    overflow-x: auto;
    overflow-y: auto;
    overscroll-behavior-inline: contain;
    -webkit-overflow-scrolling: touch;
    border: 0;
    border-radius: 0;
  }
  .forecast-matrix > :where(.scroll,.content-frame) > table {
    box-sizing: border-box;
    width: 100%;
    min-width: var(--table-content-min-width);
    height: 702px;
    table-layout: fixed;
    border-top: 1px solid rgb(0 0 0 / 0.15);
    border-left: 1px solid rgb(0 0 0 / 0.15);
  }
  /* TinyVue OS Grid 3.32.0. Keep this skin scoped: reportCompact retains its contract. */
  .table-widget.os-theme {
    --mc-table-header-row-height: 40px;
    --mc-table-header-surface: #f5f5f5;
    --mc-table-header-border: #f0f0f0;
    --mc-table-row-height: 48px;
    --mc-table-cell-border: #f0f0f0;
    font-family: Helvetica, Arial, PingFangSC-Regular, 'Hiragino Sans GB', 'Microsoft YaHei', 微软雅黑, 'Microsoft JhengHei';
    font-size: 14px;
    line-height: 1.5;
  }
  .table-widget.os-theme .scroll {
    border: 0;
  }
  .table-widget.os-theme.forecast-matrix > :where(.scroll,.content-frame) > table {
    height: auto;
    border: 0;
  }
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :global(:is(thead,tbody) > tr > .fixed-left-boundary)::after,
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :global(:is(thead,tbody) > tr > .fixed-right-boundary)::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 30px;
    pointer-events: none;
    transition: box-shadow .3s;
  }
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :global(:is(thead,tbody) > tr > .fixed-left-boundary)::after {
    right: -30px;
  }
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :global(:is(thead,tbody) > tr > .fixed-right-boundary)::after {
    left: -30px;
  }
  .table-widget.os-theme:global(.scrolled-left) > :where(.scroll,.content-frame) > table > :global(:is(thead,tbody) > tr > .fixed-left-boundary)::after {
    box-shadow: inset 10px 0 8px -8px #00000026;
  }
  .table-widget.os-theme:global(.scrolled-right) > :where(.scroll,.content-frame) > table > :global(:is(thead,tbody) > tr > .fixed-right-boundary)::after {
    box-shadow: inset -10px 0 8px -8px #00000026;
  }
  .table-widget.os-theme:global(.fixed-overflow) > :where(.scroll,.content-frame) > table > :global(thead > tr > th.fixed),
  .table-widget.os-theme:global(.fixed-overflow) > :where(.scroll,.content-frame) > table > :global(tbody > tr > td.fixed) {
    left: auto !important;
    right: auto !important;
  }
  .table-widget.os-theme:global(.fixed-overflow) > :where(.scroll,.content-frame) > table > :global(:is(thead,tbody) > tr > .fixed-left-boundary)::after,
  .table-widget.os-theme:global(.fixed-overflow) > :where(.scroll,.content-frame) > table > :global(:is(thead,tbody) > tr > .fixed-right-boundary)::after {
    display: none;
  }
  .table-widget.os-theme.static-export :global(.fixed-left-boundary)::after,
  .table-widget.os-theme.static-export :global(.fixed-right-boundary)::after {
    display: none;
  }
  /* Runtime owns the twelve-row viewport; static exports expand below. */
  .table-widget.embedded,
  .table-widget.forecast-matrix {
    height: auto;
  }
  .table-widget > :is(.scroll, .content-frame) {
    box-sizing: border-box;
    flex: 0 1 auto;
    height: auto;
    min-height: 0;
    max-height: var(--table-viewport-max-height);
    overflow: auto;
  }
  .table-widget.fixed-height {
    flex: none;
    height: var(--table-frame-height);
    overflow: auto;
  }
  .table-widget.fixed-height > .scroll {
    flex: 1 1 0;
    min-height: 0;
    max-height: none;
    overflow: auto;
  }
  .report-compact > .content-frame {
    border: 0;
  }
  .table-widget.static-export,
  .static-export .scroll,
  .static-export .content-frame {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .static-export table {
    height: auto !important;
  }
  .static-export .bottom-fade,
  .static-export > :global(.pager) {
    display: none !important;
  }
  .row-content {
    padding: 0;
    border-radius: 0;
    background: #fff;
    flex: none;
    height: auto;
  }
  .row-content > .scroll {
    height: auto;
    flex: none;
    border: 0;
  }
  .row-content :global(.table-heading) {
    margin: 0 0 12px;
  }
</style>
