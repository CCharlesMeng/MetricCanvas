<svelte:options css="injected" />
<script lang="ts" module>
  export type {TableHeaderFilterValue,TableViewState,TablePaginationState,TableSelectedCell} from './view-state';
</script>

<script lang="ts">
  import ColumnCandidateOptions from './ColumnCandidateOptions.svelte';
  import type { TableColumnCandidates } from './view-state';
  import type {TablePaginationState,TableSelectedCell} from './view-state';
  import { getContext, type Snippet } from 'svelte';
  import { currentTimeValue } from '@metriccanvas/page/internal';
  let dateMaximum = $state(currentTimeValue('date'));
  let dateError = $state('');
  import { Empty } from '@metriccanvas/ui';
  import TableHeading from './header/TableHeading.svelte';
  import TableToolbar from './TableToolbar.svelte';
  import TableControlIcon from './TableControlIcon.svelte';
  import { tableFilterPopover } from './filter-popover';
  import { tableGeometry } from './table-geometry';
  import { STATIC_EXPORT_CONTEXT } from '../../shared/export-context';
  const staticExport = Boolean(getContext(STATIC_EXPORT_CONTEXT));
  import type {
    FieldValue,
    Row,
    TableColumn,
    TableProps as TableComponentProps
  } from '@metriccanvas/page/internal';
  import type { NamedDataSlots } from '../../shared/component-data';
  import {
    resolveField,
    semanticHtmlFieldPresentation
  } from '../../shared/component-data';
  import SemanticHtml from '../../shared/SemanticHtml.svelte';
  import { projectTableRows, tableRowColumn, alignedCellText, alignedFieldValue } from './rows';
  import { mergeSpans, tableRowTier } from './presentation';
  import { buildTableColumnLayout, shouldWrapTableHeaders } from './columns';
  import type {
    TableHeaderFilterValue,
    TableSortRule,
    TableViewState
  } from './view-state';
  import { shouldShowTablePaginationControls } from './view-state';
  import { finiteNumber, formatValue, hasDisplayValue } from '../../shared/value-format';
  import { tableValueColor, valueColorStyle } from '../../shared/value-color';
  import { readPixelLength } from '../../shared/inherited-style';

  /**
   * 表格(纯渲染):行与列定义 props 进,翻页/排序/表头筛选事件出,自身零状态。
   * 常规表格使用固定表头 + 表体滚动;reportCompact 使用无边框内容层且不设滚动层;
   * 固定列(left/right)以 sticky 实现;
   * 排序状态显示在列头(多列时带优先级序号);分页由壳传入页大小与总条数。
   */
  interface Props {
    /** 已解析的 main 数据槽；rows 为空时表格仍呈现表头。 */
    nested?: boolean;
    expansion?: { key(row: Row): string | undefined; expanded(row: Row): boolean; toggle(row: Row): void; id: string };
    expandedRow?: Snippet<[Row]>;
    data: NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> };
    props: TableComponentProps;
    /** 是否呈现排序、表头筛选和分页交互;缺省 true 保持存量行为 */
    interactive?: boolean;
    /** 当前视图状态(页码/排序/表头筛选),由壳持有 */
    view: TableViewState;
    /** select 模式表头筛选候选项（兼容静态输入；运行时候选由列候选会话供给）,key = 列 field */
    columnCandidates?: Record<string, TableColumnCandidates>;
    oncandidateopen?: (field: string, open: boolean) => void;
    oncandidatesearch?: (field: string, query: string) => void;
    oncandidatemore?: (field: string) => void;
    oncandidateretry?: (field: string) => void;
    filterOptions?: Record<string, string[]>;
    filterOptionsStatus?:Record<string,'idle'|'loading'|'ready'|'empty'|'unavailable'|'error'|'denied'|'unconfigured'>;
    pagination?: TablePaginationState;
    searchDraft?: string;
    searchOption?: string;
    onsearchoption?: (value: string) => void;
    exporting?: boolean;
    exportError?: string;
    onsearchdraft?: (query: string) => void;
    onsearch?: (query: string) => void;
    onexport?: () => void;
    oncancelexport?: () => void;
    selectedCell?: TableSelectedCell;
    onpage?: (pageIndex: number) => void;
    onpagesize?: (pageSize: number) => void;
    onsort?: (sort: TableSortRule[]) => void;
    sortReset?:readonly TableSortRule[];
    onheaderfilter?: (field: string, value: TableHeaderFilterValue | null) => void;
    oncellselect?: (context: { rowIndex: number; column: TableColumn; row?:Row }) => void;
    interactionGate?: (row:Row,column:TableColumn)=>{eligible:boolean;enabled:boolean};
  toolbarEnabled?: {search:boolean;export:boolean};
  linkHref?: (row: Row, column?: TableColumn) => string | undefined;
    onlink?: (context: { rowIndex: number; column: TableColumn; row: Row }, event: MouseEvent) => void;
  }

  let {
    data,
    props,
    nested = false, expansion, expandedRow,
    interactive = true,
    view,
    columnCandidates, oncandidateopen, oncandidatesearch, oncandidatemore, oncandidateretry,
    filterOptions = {}, filterOptionsStatus = {},
    pagination,
    searchDraft, searchOption, onsearchoption, exporting, exportError, onsearchdraft, onsearch, onexport, oncancelexport,
    selectedCell,
    onpage,
    onpagesize,
    onsort, sortReset,
    onheaderfilter,
    oncellselect,
    onlink,
    interactionGate, toolbarEnabled, linkHref
  }: Props = $props();

  const expandable = $derived(Boolean(expansion && interactive && !staticExport));
  const validExpansionKeys = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const row of data.main.snapshot.rows) { const key = expansion?.key(row); if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1); }
    return new Set([...counts].filter(([, count]) => count === 1).map(([key]) => key));
  });

  const rowNumberWidth = $derived(props.rowNumber ? props.rowNumber.width ?? 64 : 0);
  const leadingColumnCount = $derived((expandable ? 1 : 0) + (props.rowNumber ? 1 : 0));
  const rowNumberOffset = $derived(staticExport ? 0 : view.pageIndex * (pagination?.pageSize ?? 0));
  const rowNumberStyle = $derived(props.rowNumber?.fixed ? `position: sticky; left: ${expandable ? 40 : 0}px;` : '');
  const columnLayout = $derived(buildTableColumnLayout(props.columns, data.main.fields));
  const leaves = $derived(columnLayout.leaves);
  const wrapHeaders = $derived(shouldWrapTableHeaders(props.fit, leaves.length));
  const rows = $derived(projectTableRows(data, props));
  const rowTiers = $derived(rows.map((row) => tableRowTier(row, props.rowKindField)));
  /** 首列合并:相邻同值折成一个单元格,rowSpan 为 0 的行不渲染该列。 */
  const rowSpans = $derived(mergeSpans(rows, props.mergeBy));
  const mergedColumnField = $derived(props.mergeBy);
  const columnWidthTotal = $derived(
    leaves.reduce((total, column) => total + (column.width ?? 120), rowNumberWidth + (expandable ? 40 : 0))
  );
  // Preserve proportional columns, with room for a short number plus cell padding.
  // Below this width the table owns horizontal scrolling rather than crushing text.
  const fitMinWidth = $derived(
    leaves.length ? columnWidthTotal * 52 / Math.min(...leaves.map(column => column.width ?? 120), ...(props.rowNumber ? [rowNumberWidth] : [])) : 0
  );

  function columnField(column: TableColumn): string {
    return resolveField(column.field, data).field;
  }

  // 固定列的 sticky 偏移:左固定列累计其前方左固定列宽度,右固定列累计其后方右固定列宽度。
  // 无显式宽度的固定列按 120px 参与累计(与 colgroup 缺省一致,保证偏移与实际渲染吻合)
  const FALLBACK_FIXED_WIDTH = 120;
  const stickyOffsets = $derived.by(() => {
    const offsets = new Map<string, number>();
    let left = (expandable ? 40 : 0) + (props.rowNumber?.fixed ? rowNumberWidth : 0);
    for (const column of leaves) {
      if (column.fixed !== 'left') continue;
      offsets.set(columnField(column), left);
      left += column.width ?? FALLBACK_FIXED_WIDTH;
    }
    let right = 0;
    for (const column of [...leaves].reverse()) {
      if (column.fixed !== 'right') continue;
      offsets.set(columnField(column), right);
      right += column.width ?? FALLBACK_FIXED_WIDTH;
    }
    return offsets;
  });

  function cellStyle(column: TableColumn): string {
    if (!column.fixed) return '';
    const offset = stickyOffsets.get(columnField(column)) ?? 0;
    return `position: sticky; ${column.fixed}: ${offset}px;`;
  }

  function columnStyle(column: TableColumn): string {
    if (props.fit === 'container') {
      const percentage = ((column.width ?? 120) / Math.max(columnWidthTotal, 1)) * 100;
      return `width: ${percentage}%;`;
    }
    return column.width ? `width: ${column.width}px; min-width: ${column.width}px;` : '';
  }

  /**
   * 表头行高唯一真源:多行粘性表头的 top 偏移与 CSS 行高共用同一数值,
   * 经根元素 CSS 变量下发,JS 与样式不再各写一份(修复默认档 40/42 错位)。
   *
   * 行高两档形态取值不同,而它同时是 JS 里的偏移量,光靠 CSS 覆写会让粘性
   * 偏移与实际行高脱钩。所以形态取值也从自身容器的计算样式读回 JS:
   * `--mc-table-header-row-height` 缺席即变体缺省档(报表形态的既有取值)。
   */
  let root = $state<HTMLElement | null>(null);
  const variantHeaderRowHeight = $derived(
    props.variant === 'forecastMatrix' ? 32 : props.variant === 'reportCompact' ? 33 : 42
  );
  const headerRowHeight = $derived(
    props.variant !== 'reportCompact' ? 40 :
      readPixelLength(root, '--mc-table-header-row-height') ?? variantHeaderRowHeight
  );

  function headerTop(rowIndex: number): number {
    return rowIndex * headerRowHeight;
  }

  const sortIndexOf = $derived(new Map(view.sort.map((rule, index) => [rule.field, index])));

  /**
   * 点击列头:该列 无排序→asc→desc→清除 循环;普通点击替换为单列排序,
   * Shift+点击保留其余列(先点先高,多列优先级映射 @order priority)。
   */
  function toggleSort(column: TableColumn, event: MouseEvent) {
    if (!column.sortable) return;
    const field = columnField(column);
    const current = view.sort.find((rule) => rule.field === field);
    const next: TableSortRule | null =
      !current
        ? { field, direction: 'asc' }
        : current.direction === 'asc'
          ? { field, direction: 'desc' }
          : sortReset&&!event.shiftKey?{field,direction:'asc'}:null;
    if (event.shiftKey) {
      const kept = view.sort.filter((rule) => rule.field !== field);
      onsort?.(next ? [...kept, next] : kept);
    } else {
      onsort?.(next ? [next] : []);
    }
  }

  function selectedValues(field: string): (string | number)[] {
    const value = view.headerFilters[field];
    return value?.mode === 'select' ? value.values : [];
  }

  function toggleFilterValue(field: string, option: string | number) {
    const current = selectedValues(field);
    const next = current.includes(option)
      ? current.filter((value) => value !== option)
      : [...current, option];
    onheaderfilter?.(field, next.length > 0 ? { mode: 'select', values: next } : null);
  }

  function dateRangeOf(field: string): { from: string; to: string } {
    const value = view.headerFilters[field];
    return value?.mode === 'dateRange' ? value : { from: '', to: '' };
  }

  /** 每次端点变更都上抛草稿,由壳回显并决定何时重查;两端清空即清除。 */
  function emitDateRange(field: string, from: string, to: string) {
    dateMaximum = currentTimeValue('date');
    dateError = from > dateMaximum || to > dateMaximum ? `日期不得晚于 ${dateMaximum}` : '';
    if (dateError) return;
    onheaderfilter?.(field, from || to ? { mode: 'dateRange', from, to } : null);
  }

  function rangeUnit(column:TableColumn):string {const definition=resolveField(column.field,data).definition;return definition?.type==='money'?'元':definition?.role==='detail'?'数值':definition?.unit??'数值';}
  function numberRangeOf(field: string): {from:string;to:string} { const value=view.headerFilters[field]; return value?.mode==='numberRange'?value:{from:'',to:''}; }
  function emitNumberRange(field:string,from:string,to:string) { onheaderfilter?.(field,from||to?{mode:'numberRange',from,to}:null); }
  function hasActiveFilter(field: string): boolean {
    return view.headerFilters[field] !== undefined;
  }

  function isSelected(rowIndex: number, column: TableColumn): boolean {
    return (
      selectedCell?.rowIndex === rowIndex &&
      selectedCell.columnField === columnField(column)
    );
  }

  function isDanger(column: TableColumn, rawValue: unknown): boolean {
    return column.dangerValues?.includes(String(rawValue ?? '')) ?? false;
  }

  function pageWindow(current: number, total: number): Array<number | '…'> {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, 6, '…', total];
    if (current >= total - 3) {
      return [1, '…', total - 5, total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '…', current - 2, current - 1, current, current + 1, current + 2, '…', total];
  }

  function closePageSizeMenu(event: MouseEvent) {
    (event.currentTarget as HTMLElement | null)
      ?.closest('details')
      ?.removeAttribute('open');
  }

  const pageSizeOptions = [10, 20, 50] as const;

  function selectPageSize(event: MouseEvent, pageSize: number) {
    closePageSizeMenu(event);
    if (pageSize !== pagination?.pageSize) onpagesize?.(pageSize);
  }

  const totalPages = $derived(
    pagination
      ? Math.max(
          1,
          Math.ceil(pagination.totalCount / pagination.pageSize)
        )
      : 0
  );
  function jumpToPage(input: HTMLInputElement) {
    const requested = Number(input.value.trim());
    if (!input.value.trim() || !Number.isSafeInteger(requested)) {
      input.value = String(view.pageIndex + 1);
      return;
    }
    const pageIndex = Math.max(1, Math.min(totalPages, requested)) - 1;
    input.value = String(pageIndex + 1);
    if (pageIndex !== view.pageIndex) onpage?.(pageIndex);
  }
  const numberedPages = $derived(
    totalPages > 0 ? pageWindow(view.pageIndex + 1, totalPages) : []
  );
  const showPaginationControls = $derived(
    pagination
      ? shouldShowTablePaginationControls(pagination.totalCount, pagination.pageSize)
      : false
  );

  const rateBarMaxima = $derived.by(() => {
    const maxima = new Map<string, number>();
    for (const column of leaves) {
      if (column.visual !== 'rateBar') continue;
      let maximum = 0;
      for (const row of rows) {
        const numeric = finiteNumber(alignedFieldValue(column.field, data, row));
        if (numeric !== undefined) maximum = Math.max(maximum, Math.abs(numeric));
      }
      maxima.set(columnField(column), maximum);
    }
    return maxima;
  });

  function rateBarWidth(
    column: TableColumn,
    value: FieldValue | undefined
  ): number {
    const numeric = finiteNumber(value);
    const maximum = rateBarMaxima.get(columnField(column)) ?? 0;
    if (numeric === undefined || maximum === 0) return 0;
    return Math.min(100, (Math.abs(numeric) / maximum) * 100);
  }
</script>

<div
  bind:this={root}
  use:tableGeometry={props.variant !== 'reportCompact' && !staticExport && leaves.length>0}
  class:os-theme={props.variant !== 'reportCompact'}
  class:fit-container={props.fit === 'container'}
  class:row-content={nested}
  class:wrap-headers={wrapHeaders}
  class:report-compact={props.variant === 'reportCompact'}
  class:embedded={props.variant === 'embedded'}
  class:forecast-matrix={props.variant === 'forecastMatrix'}
  class:compound-inline={props.compoundCellLayout === 'inline'}
  class:static-export={staticExport}
  class="table-widget"
  data-table-title={props.title}
  style:--table-header-row-height={`${headerRowHeight}px`}
  style:--table-content-min-width={`${columnWidthTotal}px`}
  style:--table-fit-min-width={`${fitMinWidth}px`}
>
  <TableHeading title={props.title} subtitle={props.subtitle} showTools={interactive && !staticExport && !!props.toolbar && leaves.length>0}>
    {#snippet tools()}
      {#if interactive && !staticExport && props.toolbar}
        <TableToolbar toolbar={props.toolbar} searchEnabled={toolbarEnabled?.search??true} canExport={toolbarEnabled?.export??true} option={searchOption} onoption={onsearchoption} draft={searchDraft} busy={exporting} error={exportError}
          ondraft={onsearchdraft} {onsearch} {onexport} oncancel={oncancelexport} />
      {/if}
    {/snippet}
  </TableHeading>
  {#if leaves.length===0}
    <Empty message="当前条件下无可见列" />
  {:else}
  <div
    class:content-frame={props.variant === 'reportCompact'}
    class:scroll={props.variant !== 'reportCompact'}
  >
    <table>
      <colgroup>
        {#if expandable}<col style="width:40px;min-width:40px" />{/if}
        {#if props.rowNumber}<col style={props.fit === 'container' ? `width: ${rowNumberWidth / columnWidthTotal * 100}%;` : `width: ${rowNumberWidth}px; min-width: ${rowNumberWidth}px;`} />{/if}
        {#each leaves as column (columnField(column))}
          <col style={columnStyle(column)} />
        {/each}
      </colgroup>
      <thead>
        {#each columnLayout.headerRows as headerRow, rowIndex (rowIndex)}
          <tr>
            {#if expandable && rowIndex === 0}<th class="expand-column fixed" data-column-index="0" rowspan={columnLayout.headerRows.length} style="left:0;top:0" aria-label="展开子表格"></th>{/if}
            {#if props.rowNumber && rowIndex === 0}
              <th class:fixed={props.rowNumber.fixed === 'left'} data-row-number data-column-index={expandable ? 1 : 0}
                rowspan={columnLayout.headerRows.length} style={`${rowNumberStyle} top: 0px;`}>
                <div class="head"><span>{props.rowNumber.title ?? '序号'}</span></div>
              </th>
            {/if}
            {#each headerRow as cell (cell.key)}
              {#if cell.kind === 'group'}
                <th
                  class="group-header"
                  colspan={cell.colspan}
                  rowspan={cell.rowspan}
                  style={`top: ${headerTop(rowIndex)}px;`}
                >
                  {cell.title}
                </th>
              {:else}
                {@const column = cell.column}
                <th
                  class:align-right={column.align === 'right'}
                  class:fixed={!!column.fixed}
                  data-column-field={columnField(column)}
                  data-column-index={leaves.findIndex(leaf => columnField(leaf) === columnField(column)) + leadingColumnCount}
                  class:last-column={columnField(column) === columnField(leaves[leaves.length - 1])}
                  colspan={cell.colspan}
                  rowspan={cell.rowspan}
                  style={`${cellStyle(column)} top: ${headerTop(rowIndex)}px;`}
                >
                  <div class="head">
                    {#if interactive && column.sortable}
                      <button
                        type="button"
                        class="sort-toggle"
                        title="点击排序,Shift+点击追加多列排序"
                        onclick={(event) => toggleSort(column, event)}
                      >
                        <span>{cell.title}</span>
                        {#if sortIndexOf.has(columnField(column))}
                          {@const rule = view.sort[sortIndexOf.get(columnField(column))!]}
                          <span class="sort-state" aria-label="排序:{rule.direction}">
                            {#if props.variant === 'reportCompact'}{rule.direction === 'asc' ? '↑' : '↓'}{:else}<TableControlIcon name={rule.direction === 'asc' ? 'sortAsc' : 'sortDesc'} />{/if}{#if view.sort.length > 1}<sup>{sortIndexOf.get(columnField(column))! + 1}</sup>{/if}
                          </span>
                        {:else}
                          <span class="sort-hint" aria-hidden="true">{#if props.variant === 'reportCompact'}⇅{:else}<TableControlIcon name="sort" />{/if}</span>
                        {/if}
                      </button>
                    {:else}
                      <span>{cell.title}</span>
                    {/if}

                    {#if interactive && column.filterable}
                      <details class="filter" use:tableFilterPopover ontoggle={event => { if (column.filterable?.mode === 'select') oncandidateopen?.(columnField(column), event.currentTarget.open); }}>
                        <summary class:active={hasActiveFilter(columnField(column))} title="表头筛选">{#if props.variant === 'reportCompact'}▼{:else}<TableControlIcon name="filter" />{/if}</summary>
                        <div class="menu" class:select-menu={column.filterable.mode === 'select'} popover="auto">
                          {#if column.filterable.mode === 'select'}
                            {#if columnCandidates}
                              <ColumnCandidateOptions field={columnField(column)} snapshot={columnCandidates[columnField(column)]}
                                selected={selectedValues(columnField(column))} onchange={value => toggleFilterValue(columnField(column), value)}
                                onsearch={oncandidatesearch} onmore={oncandidatemore} onretry={oncandidateretry} />
                            {:else}
                            {#each filterOptions[columnField(column)] ?? [] as option (option)}
                              <label class="option">
                                <input
                                  type="checkbox"
                                  checked={selectedValues(columnField(column)).includes(option)}
                                  onchange={() => toggleFilterValue(columnField(column), option)}
                                />
                                <span>{option}</span>
                              </label>
                            {:else}
                              <span class="hint">{filterOptionsStatus[columnField(column)]==='denied'?'无权访问候选项':filterOptionsStatus[columnField(column)]==='unconfigured'?'候选能力未配置':filterOptionsStatus[columnField(column)]==='unavailable'?'候选值能力不可用':filterOptionsStatus[columnField(column)]==='error'?'候选项加载失败':['ready','empty'].includes(filterOptionsStatus[columnField(column)])?'没有候选项':'候选项加载中…'}</span>
                            {/each}
                            {/if}
                          {:else if column.filterable.mode === 'dateRange'}
                            {@const range = dateRangeOf(columnField(column))}
                            <div class="range">
                              <input
                                type="date"
                                max={dateMaximum}
                                onfocus={() => { dateMaximum = currentTimeValue('date'); dateError = ''; }}
                                value={range.from}
                                onchange={(e) =>
                                  emitDateRange(columnField(column), e.currentTarget.value, range.to)}
                              />
                              <span class="sep">至</span>
                              <input
                                type="date"
                                max={dateMaximum}
                                onfocus={() => { dateMaximum = currentTimeValue('date'); dateError = ''; }}
                                value={range.to}
                                onchange={(e) =>
                                  emitDateRange(columnField(column), range.from, e.currentTarget.value)}
                              />
                            </div>
                            {#if dateError}<span class="hint" role="status">{dateError}</span>{/if}
                          {:else if column.filterable.mode === 'numberRange'}
                            {@const range=numberRangeOf(columnField(column))}
                            <div class="range">
                              <input type="text" inputmode="decimal" aria-label="数值下限" placeholder="下限" value={range.from} onchange={e=>emitNumberRange(columnField(column),e.currentTarget.value,range.to)} />
                              <span class="sep">至</span>
                              <input type="text" inputmode="decimal" aria-label="数值上限" placeholder="上限" value={range.to} onchange={e=>emitNumberRange(columnField(column),range.from,e.currentTarget.value)} />
                            </div>
                            <span class="hint">原始单位：{rangeUnit(column)}</span>
                          {/if}
                          {#if hasActiveFilter(columnField(column))}
                            <button
                              type="button"
                              class="clear"
                              onclick={() => onheaderfilter?.(columnField(column), null)}
                            >
                              清除筛选
                            </button>
                          {/if}
                        </div>
                      </details>
                    {/if}
                  </div>
                </th>
              {/if}
            {/each}
          </tr>
        {/each}
      </thead>
      <tbody>
        {#each rows as row, i (expandable && validExpansionKeys.has(expansion?.key(row.main) ?? '') ? expansion!.key(row.main)! : i)}
          <tr class:subtotal-row={rowTiers[i] === 'subtotal'} class:total-row={row.kind !== 'pinnedTop' && rowTiers[i] === 'total'} data-pinned-top={row.kind === 'pinnedTop' ? '' : undefined}>
            {#if expandable}
              <td class="expand-column fixed" data-column-index="0" style="left:0">
                {#if rowTiers[i] !== 'subtotal' && rowTiers[i] !== 'total' && validExpansionKeys.has(expansion!.key(row.main) ?? '')}
                  <button class="row-expand-button" type="button" aria-label={expansion!.expanded(row.main) ? '收起子表格' : '展开子表格'}
                    aria-expanded={expansion!.expanded(row.main)} aria-controls={`${expansion!.id}-${encodeURIComponent(expansion!.key(row.main)!)}`}
                    onclick={() => expansion!.toggle(row.main)}><TableControlIcon name={expansion!.expanded(row.main) ? 'down' : 'right'} /></button>
                {/if}
              </td>
            {/if}
            {#if props.rowNumber}
              <td class:fixed={props.rowNumber.fixed === 'left'} data-row-number data-column-index={expandable ? 1 : 0} style={rowNumberStyle}>{row.kind === 'pinnedTop' ? '' : rowNumberOffset + (row.bodyIndex ?? i) + 1}</td>
            {/if}
            {#each leaves as bodyColumn, columnIndex (columnField(bodyColumn))}
              {@const column = tableRowColumn(bodyColumn, row, data)}
              <!-- 合并列上被并入上方单元格的行不渲染该列 -->
              {#if row.kind === 'pinnedTop' || columnField(bodyColumn) !== mergedColumnField || rowSpans[i] !== 0}
                {@const resolved = resolveField(column.field, data)}
                {@const rawValue = alignedFieldValue(column.field, data, row)}
                {@const hasValue = hasDisplayValue(rawValue)}
                {@const color = tableValueColor(rawValue, column, resolved.format)}
                {@const semanticPresentation = semanticHtmlFieldPresentation(
                  resolved,
                  rawValue,
                  column.visual === 'signed' ? 'signed' : undefined
                )}
                {#snippet supplementaryFields()}
                  {#if column.secondaryField}
                    {@const secondary = resolveField(column.secondaryField, data)}
                    <small>{alignedCellText(column.secondaryField, data, row)}</small>
                  {/if}
                  {#if column.badgeField}
                    {@const badge = resolveField(column.badgeField, data)}
                    <small class="cell-badge">{alignedCellText(column.badgeField, data, row)}</small>
                  {/if}
                {/snippet}
                {@const actionGate=row.kind === 'pinnedTop' ? {eligible:false,enabled:false} : interactionGate?.(row.main,column)??{eligible:true,enabled:true}}
                <td
                  class:align-right={column.align === 'right'}
                  class:fixed={!!column.fixed}
                  class:emphasized={column.emphasis === 'strong'}
                  class:selectable={Boolean(hasValue && column.selection && interactive && actionGate.eligible)}
                  class:linkable={Boolean(hasValue && column.link && interactive && !column.selection && actionGate.eligible)}
                  class:selected={row.kind !== 'pinnedTop' && isSelected(row.bodyIndex ?? i, column)}
                  class:danger={isDanger(column, rawValue)}
                  class:negative={semanticPresentation === undefined && color === 'red'}
                  class:positive={semanticPresentation === undefined && color === 'green'}
                  class:explicit-color={column.colorRule !== undefined}
                  data-column-field={columnField(bodyColumn)}
                  data-column-index={columnIndex + leadingColumnCount}
                  rowspan={row.kind !== 'pinnedTop' && columnField(bodyColumn) === mergedColumnField ? rowSpans[i] : undefined}
                  style={cellStyle(bodyColumn)}
                  style:color={column.colorRule ? valueColorStyle(color) : undefined}
                >
                  {#if hasValue && column.selection && interactive && actionGate.eligible}
                    <button
                      type="button"
                      class="selectable-cell"
                      aria-pressed={isSelected(row.bodyIndex ?? i, column)}
                      disabled={!actionGate.enabled}
                      onclick={() => oncellselect?.({ rowIndex: row.bodyIndex ?? i, column, row:row.main })}
                    >
                      <span class="cell-stack">
                        {#if semanticPresentation}
                          <SemanticHtml
                            source={semanticPresentation.source}
                            format={semanticPresentation.format}
                            visual={semanticPresentation.visual}
                            inline
                          />
                        {:else}
                          <span class="cell-primary-value">{alignedCellText(column.field, data, row)}</span>
                        {/if}
                        {@render supplementaryFields()}
                      </span>
                    </button>
                  {:else if hasValue && column.link && interactive && !column.selection && actionGate.eligible}
                    <a
                      href={actionGate.enabled?linkHref?.(row.main, column):undefined}
                      aria-disabled={!actionGate.enabled}
                      role={linkHref?.(row.main, column) ? undefined : 'button'}
                      tabindex={!actionGate.enabled?-1:linkHref?.(row.main,column)?undefined:0}
                      class="link-cell"
                      onkeydown={(event) => {
                        if (actionGate.enabled && !linkHref?.(row.main, column) && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          event.currentTarget.click();
                        }
                      }}
                      onclick={(event) => {if(actionGate.enabled)onlink?.({ rowIndex: row.bodyIndex ?? i, column, row: row.main }, event);else event.preventDefault();}}
                    >
                      <span class="cell-stack">
                        {#if semanticPresentation}
                          <SemanticHtml
                            source={semanticPresentation.source}
                            format={semanticPresentation.format}
                            visual={semanticPresentation.visual}
                            inline
                          />
                        {:else}
                          <span class="cell-primary-value">{alignedCellText(column.field, data, row)}</span>
                        {/if}
                        {@render supplementaryFields()}
                      </span>
                    </a>
                  {:else if column.visual === 'rateBar' && semanticPresentation === undefined}
                    <div class="cell-stack">
                    <span class="rate-cell">
                      <span
                        aria-hidden="true"
                        class="rate-bar"
                        style={`width: ${rateBarWidth(bodyColumn, rawValue)}%;`}
                      ></span>
                      <span class="cell-value">{alignedCellText(column.field, data, row)}</span>
                    </span>
                    {@render supplementaryFields()}
                    </div>
                  {:else}
                    <div class="cell-stack">
                      {#if semanticPresentation}
                        <SemanticHtml
                          source={semanticPresentation.source}
                          format={semanticPresentation.format}
                          visual={semanticPresentation.visual}
                          inline
                        />
                      {:else}
                        <span class="cell-primary-value">{alignedCellText(column.field, data, row)}</span>
                      {/if}
                      {@render supplementaryFields()}
                    </div>
                  {/if}
                </td>
              {/if}
            {/each}
          </tr>
          {#if expandable && expandedRow && validExpansionKeys.has(expansion!.key(row.main) ?? '') && expansion!.expanded(row.main)}
            <tr class="row-expansion-row"><td class="row-expansion-cell" colspan={leaves.length + leadingColumnCount}>
              <div id={`${expansion!.id}-${encodeURIComponent(expansion!.key(row.main)!)}`} role="region" aria-label="子表格" class="row-expansion-content">{@render expandedRow(row.main)}</div>
            </td></tr>
          {/if}
        {:else}
          <tr>
            <td class="empty-row" colspan={Math.max(leaves.length + leadingColumnCount, 1)}>{#if props.variant === 'reportCompact'}暂无数据{:else}<div class="empty-state">暂无数据</div>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if props.bottomFade}
    <div class="bottom-fade" aria-hidden="true"></div>
  {/if}

  {#if props.pagination && props.pagination.mode !== 'none' && interactive && pagination}
    <div class="pager">
      <span class="total">总条数： <span>{pagination.totalCount}</span></span>
      {#if showPaginationControls}
        <div class="pager-actions">
          <details class="page-size-select">
            <summary aria-label={`每页 ${pagination.pageSize} 条`}>
              <span>{pagination.pageSize}</span>
              <span aria-hidden="true" class="page-size-arrow"><TableControlIcon name="down" /></span>
            </summary>
            <div aria-label="每页显示数量" class="page-size-menu" role="listbox">
              {#each pageSizeOptions as pageSize}
                <button
                  aria-selected={pageSize === pagination.pageSize}
                  class:selected={pageSize === pagination.pageSize}
                  onclick={(event) => selectPageSize(event, pageSize)}
                  role="option"
                  type="button"
                >{pageSize}</button>
              {/each}
            </div>
          </details>
          <button
            type="button"
            class="pager-nav pager-prev"
            aria-label="上一页"
            disabled={view.pageIndex === 0}
            onclick={() => onpage?.(view.pageIndex - 1)}
          >
            <TableControlIcon name="left" />
          </button>
          {#if (props.pagination.mode === 'query' || props.pagination.numbered) && numberedPages.length > 0}
            {#each numberedPages as item, itemIndex (`${item}:${itemIndex}`)}
              {#if item === '…'}
                <span class="ellipsis">…</span>
              {:else}
                <button
                  type="button"
                  class="page-button"
                  class:last-page={itemIndex === numberedPages.length - 1}
                  class:current={item === view.pageIndex + 1}
                  aria-current={item === view.pageIndex + 1 ? 'page' : undefined}
                  onclick={() => onpage?.(item - 1)}
                >{item}</button>
              {/if}
            {/each}
          {:else}
            <span class="page-no">第 {view.pageIndex + 1} 页</span>
          {/if}
          <button
            type="button"
            class="pager-nav pager-next"
            aria-label="下一页"
            disabled={view.pageIndex + 1 >= totalPages}
            onclick={() => onpage?.(view.pageIndex + 1)}
          >
            <TableControlIcon name="right" />
          </button>
          <label class="page-jump">
            <span class="jump-label">跳至</span>
            <input aria-label="跳转页码" inputmode="numeric" value={view.pageIndex + 1}
              onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); jumpToPage(event.currentTarget); } }}
              onchange={event => jumpToPage(event.currentTarget)} />
            <span class="jump-suffix">页</span>
          </label>
        </div>
      {/if}
    </div>
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
    padding: 19px 19px 11px;
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
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: auto;
  }
  /* 表头的高度、底色与分隔线两档形态取值不同;高度由脚本按同一个自定义属性
     算出后写回本元素,粘性偏移与行高因此仍共用一个数。 */
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    box-sizing: border-box;
    height: var(--table-header-row-height, 42px);
    background: var(--mc-table-header-surface, var(--mc-color-surface-subtle, #f1f4ff));
    text-align: left;
    font-weight: 500;
    color: #595959;
    padding: 8px 10px;
    border-right: 1px solid var(--mc-table-header-border, #d8deeb);
    border-bottom: 1px solid var(--mc-table-header-border, #d8deeb);
    white-space: nowrap;
  }
  thead th.group-header {
    color: #08359e;
    text-align: center;
  }
  thead th.align-right,
  tbody td.align-right {
    text-align: right;
  }
  /* 固定列:sticky 左/右偏移由内联 style 提供;表头交叉区需更高层级 */
  thead th.fixed {
    z-index: 3;
  }
  td.fixed {
    position: sticky;
    z-index: 1;
    background: #fff;
  }
  /* 行高与横竖分隔线两档形态取值不同;分隔线共用一个色,横竖不分家。 */
  tbody td {
    height: var(--mc-table-row-height, 40px);
    padding: 8px 10px;
    border-right: 1px solid var(--mc-table-cell-border, #edf0f5);
    border-bottom: 1px solid var(--mc-table-cell-border, #edf0f5);
    background: #fff;
    color: #191919;
    white-space: nowrap;
  }
  .embedded > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) {
    box-sizing: border-box;
    height: 48px;
    padding: 0 6px;
    overflow: visible;
    border-right: 0;
    line-height: 20px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .embedded > :where(.scroll,.content-frame) > table > thead th {
    box-sizing: border-box;
    height: 64px;
    padding: 0 6px;
    line-height: 20px;
  }
  .embedded > :where(.scroll,.content-frame) > table > thead th:last-child {
    border-right: 0;
  }
  .embedded > :where(.scroll,.content-frame) > table > thead > tr > th .head > span:first-child,
  .embedded > :where(.scroll,.content-frame) > table > thead > tr > th .sort-toggle > span:first-child {
    overflow-wrap: normal;
    white-space: pre-line;
  }
  .embedded > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .cell-stack,
  .embedded > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .cell-primary-value,
  .embedded > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .link-cell {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: visible;
    line-height: 20px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .embedded > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .link-cell {
    color: #191919;
  }
  .embedded > :where(.scroll,.content-frame) > table > thead > tr > th .sort-hint,
  .embedded > :where(.scroll,.content-frame) > table > thead > tr > th .sort-state {
    opacity: 0;
  }
  .embedded th:hover .sort-hint,
  .embedded th:focus-within .sort-hint,
  .embedded th:focus-within .sort-state {
    opacity: 1;
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
  tbody td.danger {
    color: #f23030;
  }
  tbody td.emphasized {
    font-weight: 600;
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  /* 行类别档位:小计与合计的视觉区分。档位由计算阶段的标记决定,表格不判定业务。 */
  tbody tr.subtotal-row td {
    background: #f7f9ff;
    font-weight: 600;
  }
  tbody tr.total-row td {
    background: #eef3ff;
    color: #08359e;
    font-weight: 700;
  }
  tbody tr[data-pinned-top] td {
    font-weight: 600;
  }
  tbody td.positive {
    color: var(--mc-color-positive, #52c41a);
  }
  tbody td.negative {
    color: var(--mc-color-negative, #f5222d);
  }
  .selectable-cell {
    width: 100%;
    padding: 2px 6px;
    color: inherit;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
    text-align: inherit;
  }
  .selectable-cell[aria-pressed='true'] {
    color: inherit;
    background: transparent;
    border-color: transparent;
    font-weight: 650;
  }
  .selectable-cell:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 1px;
  }
  .selectable-cell,
  .selectable-cell .cell-primary-value,
  .link-cell .cell-primary-value {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .link-cell {
    width: 100%;
    padding: 0;
    color: #08359e;
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    text-align: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .link-cell:focus-visible {
    outline: 2px solid rgb(8 53 158 / 0.28);
    outline-offset: 1px;
    border-radius: 4px;
  }
  tbody td.explicit-color .selectable-cell,
  tbody td.explicit-color .link-cell,
  tbody td.explicit-color .cell-primary-value {
    color: inherit;
  }
  td.linkable {
    cursor: pointer;
  }
  .cell-stack {
    display: inline-flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }
  .cell-stack small {
    color: #71717a;
    font-size: 11px;
    line-height: 1.2;
  }
  .cell-stack .cell-badge {
    padding: 2px 6px;
    color: #1476ff;
    background: rgb(20 118 255 / 0.08);
    border-radius: 3px;
  }
  .compound-inline .cell-stack {
    align-items: center;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
  }
  .compound-inline .cell-stack small {
    padding: 2px 6px;
    color: #1476ff;
    background: rgb(20 118 255 / 0.08);
    border-radius: 3px;
    font-size: 12px;
    line-height: 20px;
  }
  .rate-cell {
    position: relative;
    display: inline-flex;
    justify-content: flex-end;
    min-width: 72px;
    padding: 2px 4px;
    overflow: hidden;
    border-radius: 3px;
  }
  .rate-bar {
    position: absolute;
    inset: 0 auto 0 0;
    max-width: 100%;
    background: #dbeafe;
    border-radius: inherit;
  }
  .cell-value {
    position: relative;
    z-index: 1;
    font-variant-numeric: tabular-nums;
  }
  .empty-row {
    text-align: center;
    color: #71717a;
    padding: 24px 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  th.align-right .head {
    justify-content: flex-end;
  }
  .sort-toggle {
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    color: inherit;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
  .sort-state {
    color: #2563eb;
  }
  .sort-state sup {
    font-size: 10px;
  }
  .sort-hint {
    color: #d4d4d8;
    font-size: 11px;
  }
  .filter {
    position: relative;
  }
  .filter summary {
    list-style: none;
    cursor: pointer;
    color: #a1a1aa;
    font-size: 9px;
    padding: 2px 4px;
    border-radius: 4px;
    user-select: none;
  }
  .filter summary::-webkit-details-marker {
    display: none;
  }
  .filter summary.active {
    color: #2563eb;
  }
  .filter summary:hover {
    background: #f4f4f5;
  }
  .menu {
    position: fixed;
    z-index: 10;
    inset: auto;
    margin: 0;
    min-width: 160px;
    max-width: calc(100vw - 16px);
    max-height: 240px;
    overflow: auto;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.1);
    padding: 6px;
    display: flex;
    flex-direction: column;
    font-weight: 400;
  }
  .menu[popover]:not(:popover-open) {
    display: none;
  }
  .menu.select-menu {
    box-sizing: border-box;
    width: max-content;
    min-width: min(160px, calc(100vw - 16px));
    max-width: min(360px, calc(100vw - 16px));
  }
  .select-menu .option {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }
  .option:hover {
    background: #f4f4f5;
  }
  .hint {
    padding: 6px 8px;
    color: #a1a1aa;
  }
  .range {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
  }
  .range input {
    padding: 4px 6px;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
  }
  .sep {
    color: #a1a1aa;
  }
  .clear {
    margin-top: 4px;
    border: 0;
    border-top: 1px solid #f4f4f5;
    background: transparent;
    padding: 8px;
    color: #2563eb;
    font-size: 13px;
    cursor: pointer;
  }
  .pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 32px;
    margin-top: 0;
    padding: 24px 0 8px;
    color: #191919;
    font-size: 14px;
    line-height: 1;
    font-family: Helvetica, Arial, PingFangSC-Regular, 'Hiragino Sans GB', 'Microsoft YaHei', 微软雅黑, 'Microsoft JhengHei';
  }
  .pager-actions {
    display: flex;
    flex-wrap:wrap; max-width:100%;
    align-items: center;
    min-height: 32px;
  }
  .total {
    color: #191919;
    line-height: 32px;
    white-space: nowrap;
  }
  .page-size-select {
    position: relative;
    flex: none;
  }
  .page-size-select summary {
    box-sizing: border-box;
    display: flex;
    height: 32px;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px 0 12px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    background: #fff;
    color: #191919;
    cursor: pointer;
    list-style: none;
    outline: 0;
    user-select: none;
  }
  .page-size-select summary > span:first-child {
    margin-right: 4px;
  }
  .page-size-select summary::-webkit-details-marker {
    display: none;
  }
  .page-size-select summary:hover {
    border-color: #191919;
  }
  .page-size-select summary:active {
    border-color: #191919;
  }
  .page-size-select summary:focus-visible {
    outline: 2px solid rgb(20 118 255 / 0.28);
    outline-offset: 1px;
  }
  .page-size-arrow {
    position: relative;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    top: -1px;
    color: #808080;
    transition: transform .3s;
  }
  .page-size-select summary:hover .page-size-arrow { color: #191919; }
  .page-size-select[open] .page-size-arrow {
    transform: rotate(180deg);
  }
  .page-size-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    box-sizing: border-box;
    width: 100%;
    min-width: 70px;
    padding: 8px 0;
    overflow: hidden;
    border-radius: 6px;
    background: #fff;
    box-shadow: 0 2px 12px rgb(0 0 0 / 0.16);
  }
  .page-size-menu button {
    display: block;
    width: 100%;
    height: 32px;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 0 16px;
    color: #191919;
    font: inherit;
    font-size: 12px;
    line-height: 32px;
    text-align: left;
    cursor: pointer;
  }
  .page-size-menu button:hover,
  .page-size-menu button:active {
    background: #f5f5f5;
  }
  .page-size-menu button.selected {
    color: #1476ff;
    font-weight: 700;
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
  .report-compact > :where(.scroll,.content-frame) > table > thead th {
    padding: 5px 8px;
    border-right: 1px solid #d8deeb;
    border-bottom: 1px solid #d8deeb;
    font-size: 14px;
    line-height: 22px;
  }
  .report-compact > :where(.scroll,.content-frame) > table > thead th:last-child {
    border-right: 0;
  }
  .report-compact > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) {
    height: 42px;
    padding: 7px 8px;
    border-right: 0;
    border-bottom: 1px solid #edf0f5;
  }
  .page-button,
  .pager-nav {
    box-sizing: border-box;
    height: 32px;
    border: 1px solid transparent;
    background: transparent;
    color: #595959;
    font: inherit;
    cursor: pointer;
  }
  .page-button {
    display: block;
    min-width: 32px;
    margin-right: 4px;
    padding: 0 8px;
    border-radius: 999px;
    line-height: 30px;
    text-align: center;
    transition: all .5s ease;
  }
  .page-button.last-page {
    margin-right: 0;
  }
  .page-button:hover,
  .page-button:active {
    background: #f5f5f5;
    color: #808080;
  }
  .page-button:hover:not(.current) { font-weight: 600; }
  .page-button:focus-visible,
  .pager-nav:focus-visible,
  .page-size-menu button:focus-visible {
    outline: 2px solid rgb(20 118 255 / 0.28);
    outline-offset: 1px;
  }
  .pager-nav {
    display: inline-flex;
    width: 18px;
    min-width: 18px;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: #191919;
  }
  .pager-prev {
    margin-left: 16px;
    margin-right: 8px;
  }
  .pager-next {
    margin-left: 8px;
  }
  .pager-nav:hover:not(:disabled),
  .pager-nav:active:not(:disabled) {
    color: #191919;
  }
  .pager-nav:disabled {
    color: #c2c2c2;
    cursor: not-allowed;
  }
  .page-button.current {
    background: #f5f5f5;
    color: #191919;
    font-weight: 700;
  }
  .ellipsis {
    display: block;
    min-width: 32px;
    height: 32px;
    margin-right: 4px;
    color: #595959;
    line-height: 30px;
    text-align: center;
  }
  .page-no {
    color: #71717a;
  }
  .page-jump {
    display: inline-flex;
    align-items: center;
    height: 32px;
    white-space: nowrap;
  }
  .jump-label { padding-left: 16px; margin-right: 8px; }
  .page-jump input {
    box-sizing: border-box;
    width: 48px;
    height: 32px;
    margin-right: 4px;
    padding: 1px 2px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    background: #fff;
    color: #191919;
    font: inherit;
    text-align: center;
    outline: none;
    line-height: 32px;
    transition: border .3s;
  }
  .page-jump input:hover, .page-jump input:focus { border-color: #191919; }
  .jump-suffix { padding-left: 4px; margin-right: 8px; }
  .fit-container > .scroll {
    overflow-x: auto;
  }
  .fit-container > :where(.scroll,.content-frame) > table {
    table-layout: fixed;
    min-width: var(--table-fit-min-width);
  }
  .fit-container > :where(.scroll,.content-frame) > table > thead th {
    min-width: 0;
    overflow-wrap: normal;
    white-space: nowrap;
  }
  .wrap-headers thead th {
    padding-right: 6px;
    padding-left: 6px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .wrap-headers .head,
  .wrap-headers .sort-toggle {
    min-width: 0;
  }
  .wrap-headers .sort-toggle {
    width: 100%;
  }
  .wrap-headers .sort-toggle > span:first-child {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .wrap-headers .sort-state,
  .wrap-headers .sort-hint {
    flex: none;
  }
  .fit-container > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .fit-container.embedded > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .forecast-matrix > :where(.scroll,.content-frame) > table > thead th,
  .forecast-matrix > :where(.scroll,.content-frame) > table > thead th.group-header {
    box-sizing: border-box;
    height: 32px;
    padding: 0 4px;
    color: #595959;
    background: rgb(0 0 0 / 0.05);
    border-right: 1px solid rgb(0 0 0 / 0.15);
    border-bottom: 1px solid rgb(0 0 0 / 0.15);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    text-align: center;
    white-space: nowrap;
  }
  .forecast-matrix > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)),
  .forecast-matrix.fit-container > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) {
    box-sizing: border-box;
    height: 58px;
    padding: 0 4px;
    overflow: visible;
    color: #191919;
    background: #fff;
    border-right: 1px solid rgb(0 0 0 / 0.15);
    border-bottom: 1px solid rgb(0 0 0 / 0.15);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    text-align: center;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .forecast-matrix > :where(.scroll,.content-frame) > table > tbody > tr.subtotal-row > td:not(:where(.row-expansion-cell)),
  .forecast-matrix > :where(.scroll,.content-frame) > table > tbody > tr.total-row > td:not(:where(.row-expansion-cell)),
  .forecast-matrix > :where(.scroll,.content-frame) > table > tbody > tr.subtotal-row > td:not(:where(.row-expansion-cell)).fixed,
  .forecast-matrix > :where(.scroll,.content-frame) > table > tbody > tr.total-row > td:not(:where(.row-expansion-cell)).fixed {
    background: rgb(20 118 255 / 0.05);
    font-weight: 500;
  }
  .forecast-matrix > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .cell-stack,
  .forecast-matrix > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .cell-primary-value {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: visible;
    line-height: 20px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .fit-container > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .cell-stack,
  .fit-container > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .rate-cell {
    min-width: 0;
    max-width: 100%;
  }
  .fit-container > :where(.scroll,.content-frame) > table > tbody > tr > td:not(:where(.row-expansion-cell)) .rate-cell {
    width: 100%;
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
  .table-widget.os-theme .scroll { border: 0; }
  .table-widget.os-theme.forecast-matrix > :where(.scroll,.content-frame) > table { height: auto; border: 0; }
  .table-widget.os-theme thead th {
    top: var(--table-header-top, 0px) !important;
    height: 40px;
    padding: 4px 16px;
    background: #f5f5f5;
    color: #595959;
    font-weight: 600;
    line-height: 21px;
    border-right: 0;
    border-bottom: 1px solid #f0f0f0;
    white-space: normal;
    overflow-wrap: break-word;
  }
  .table-widget.os-theme thead th:not(.last-column)::before {
    content: '';
    position: absolute;
    top: 50%;
    right: 0;
    width: 1px;
    height: 16px;
    transform: translateY(-50%);
    background: #dbdbdb;
    pointer-events: none;
  }
  .table-widget.os-theme thead th.group-header { color: #595959; }
  .table-widget.os-theme .head, .table-widget.os-theme .sort-toggle { min-width: 0; }
  .table-widget.os-theme .head > span:first-child, .table-widget.os-theme .sort-toggle > span:first-child {
    min-width: 0;
    color: inherit;
    font-size: 14px;
    line-height: 21px;
    font-weight: 600;
    white-space: normal;
    overflow-wrap: break-word;
  }
  .table-widget.os-theme .sort-toggle { width: auto; }
  .table-widget.os-theme .head { gap: 0; }
  .table-widget.os-theme.forecast-matrix > :where(.scroll,.content-frame) > table > thead > tr > th .head { justify-content: center; }
  .table-widget.os-theme.forecast-matrix > :where(.scroll,.content-frame) > table > thead > tr > th.align-right .head { justify-content: flex-end; }
  .table-widget.os-theme.forecast-matrix > :where(.scroll,.content-frame) > table > tbody > tr > td.align-right { text-align: right; }
  .table-widget.os-theme .sort-toggle { gap: 4px; }
  .table-widget.os-theme .sort-state, .table-widget.os-theme .sort-hint {
    display: inline-flex;
    align-items: center;
    flex: none;
    color: #808080;
    font-size: 16px;
    line-height: 16px;
    opacity: 1;
  }
  .table-widget.os-theme .sort-state, .table-widget.os-theme .sort-toggle:hover .sort-hint { color: #191919; }
  .table-widget.os-theme tbody td {
    box-sizing: border-box;
    height: 48px;
    padding: 12px 16px;
    border-right: 0;
    border-bottom: 1px solid #f0f0f0;
    line-height: 21px;
    white-space: normal;
    overflow-wrap: break-word;
    overflow: visible;
    text-overflow: clip;
  }
  .table-widget.os-theme tbody tr:last-child td { border-bottom: 1px solid #f0f0f0; }
  .table-widget.os-theme tbody .cell-stack, .table-widget.os-theme tbody .cell-primary-value, .table-widget.os-theme tbody .link-cell {
    line-height: 21px;
    overflow-wrap: break-word;
  }
  .table-widget.os-theme tbody td.positive { color: var(--mc-color-positive, #52c41a); }
  .table-widget.os-theme tbody td.negative { color: var(--mc-color-negative, #f5222d); }
  .table-widget.os-theme .link-cell { color: #191919; }
  .table-widget.os-theme tbody td:is(.explicit-color, .positive, .negative, .danger) .link-cell { color: inherit; }
  .table-widget.os-theme th.fixed, .table-widget.os-theme td.fixed {
    left: var(--table-sticky-left, auto) !important;
    right: var(--table-sticky-right, auto) !important;
  }
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > :global(.fixed-left-boundary)::after,
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > :global(.fixed-right-boundary)::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 30px;
    pointer-events: none;
    transition: box-shadow .3s;
  }
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > :global(.fixed-left-boundary)::after { right: -30px; }
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > :global(.fixed-right-boundary)::after { left: -30px; }
  .table-widget.os-theme:global(.scrolled-left) > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > :global(.fixed-left-boundary)::after { box-shadow: inset 10px 0 8px -8px #00000026; }
  .table-widget.os-theme:global(.scrolled-right) > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > :global(.fixed-right-boundary)::after { box-shadow: inset -10px 0 8px -8px #00000026; }
  .table-widget.os-theme:global(.fixed-overflow) > :where(.scroll,.content-frame) > table > thead > tr > th.fixed,
  .table-widget.os-theme:global(.fixed-overflow) > :where(.scroll,.content-frame) > table > tbody > tr > td.fixed { left: auto !important; right: auto !important; }
  .table-widget.os-theme:global(.fixed-overflow) > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > :global(.fixed-left-boundary)::after,
  .table-widget.os-theme:global(.fixed-overflow) > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > :global(.fixed-right-boundary)::after { display: none; }
  .table-widget.os-theme .filter summary {
    --table-control-icon-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0 0 4px;
    color: #999;
    border-radius: 0;
  }
  .table-widget.os-theme .filter summary:hover { color: #191919; background: transparent; }
  .table-widget.os-theme .filter summary.active { color: #191919; }
  .table-widget.os-theme .menu {
    box-sizing: border-box;
    padding: 4px 8px 8px;
    border: 0;
    border-radius: 6px;
    box-shadow: 0 2px 12px #0003;
    color: #191919;
    font-size: 14px;
    line-height: 21px;
  }
  .table-widget.os-theme .menu:not(.select-menu) { min-width: min(270px, calc(100vw - 16px)); }
  .table-widget.os-theme .option , .table-widget.os-theme :global(.candidate-option) { box-sizing: border-box; min-height: 28px; padding: 0 8px; border-radius: 0; }
  .table-widget.os-theme .option:hover , .table-widget.os-theme :global(.candidate-option:hover) { background: #f5f5f5; }
  .table-widget.os-theme .option input , .table-widget.os-theme :global(.candidate-option input) {
    appearance: none;
    flex: none;
    box-sizing: border-box;
    width: 16px;
    height: 16px;
    margin: 0;
    border: 1px solid #c2c2c2;
    border-radius: 4px;
    background: #fff;
  }
  .table-widget.os-theme .option input:hover , .table-widget.os-theme :global(.candidate-option input:hover) { border-color: #191919; }
  .table-widget.os-theme .option input:checked , .table-widget.os-theme :global(.candidate-option input:checked) { border-color: #1476ff; background: #1476ff; position: relative; }
  .table-widget.os-theme .option input:checked::after , .table-widget.os-theme :global(.candidate-option input:checked::after) { content: ''; position: absolute; width: 7px; height: 4px; left: 3px; top: 3px; border-left: 1px solid #fff; border-bottom: 1px solid #fff; transform: rotate(-45deg); }
  .table-widget.os-theme .option input:focus-visible , .table-widget.os-theme :global(.candidate-option input:focus-visible) { outline: 2px solid #191919; outline-offset: 2px; }
  .table-widget.os-theme .range { min-width: 0; padding: 8px 0; }
  .table-widget.os-theme .range input { box-sizing: border-box; min-width: 0; width: 0; flex: 1; height: 32px; padding: 0 8px; border: 1px solid #c2c2c2; border-radius: 6px; color: #191919; font: inherit; }
  .table-widget.os-theme .range input:hover, .table-widget.os-theme .range input:focus { border-color: #191919; outline: none; }
  .table-widget.os-theme .clear { color: #191919; border-top-color: #f0f0f0; }
  .table-widget.os-theme .page-size-select { margin-left: 16px; }
  .table-widget.os-theme .empty-row { height: auto; padding: 0; color: #191919; text-align: center; }
  .table-widget.os-theme .empty-state { box-sizing: border-box; display: flex; min-height: 60px; padding: 60px 0; align-items: center; justify-content: center; text-align: center; }
  .table-widget.os-theme.static-export :global(.fixed-left-boundary)::after,
  .table-widget.os-theme.static-export :global(.fixed-right-boundary)::after { display: none; }
  .table-widget.static-export, .static-export .scroll, .static-export .content-frame { height:auto!important; min-height:0!important; max-height:none!important; overflow:visible!important; }
  .static-export table { height:auto!important; }
  .static-export th, .static-export td { position:static!important; }
  .table-widget.os-theme.static-export th { position: relative !important; top: auto !important; left: auto !important; right: auto !important; }
  .static-export thead { display:table-header-group; }
  .static-export tr { break-inside:avoid; }
  .static-export .bottom-fade, .static-export .pager { display:none!important; }

  .row-content { padding:0; border-radius:0; background:#fff; flex:none; height:auto; }
  .row-content > .scroll { height:auto; flex:none; border:0; }
  .row-content :global(.table-heading) { margin:0 0 12px; }
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > :is(thead,tbody) > tr > .expand-column { width:40px; min-width:40px; padding:0; text-align:center; }
  .row-expand-button { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border:0; background:transparent; color:inherit; cursor:pointer; }
  .row-expand-button:focus-visible { outline:2px solid #1476ff; outline-offset:-2px; }
  .table-widget.os-theme > :where(.scroll,.content-frame) > table > tbody > .row-expansion-row > .row-expansion-cell { padding:16px 16px 16px 40px; background:#fff; }
  .row-expansion-content { width:100%; max-width:max(0px,calc(var(--table-viewport-width,100000px) - 56px)); min-width:0; container-type:inline-size; background:#fff; }
</style>
