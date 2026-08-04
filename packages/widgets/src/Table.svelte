<script lang="ts" module>
  export type { TableHeaderFilterValue, TableViewState } from './table-view';
  export interface TablePaginationState {
    pageSize: number;
    totalCount: number;
  }
  export interface TableSelectedCell {
    rowIndex: number;
    columnField: string;
  }
</script>

<script lang="ts">
  import type { TableColumn, TableProps as TableComponentProps } from '@metriccanvas/page';
  import type { NamedDataSlots } from './component-data';
  import { resolveField } from './component-data';
  import { alignTableRows, alignedFieldValue } from './table-data';
  import { buildTableColumnLayout } from './table-columns';
  import type {
    TableHeaderFilterValue,
    TableSortRule,
    TableViewState
  } from './table-view';
  import { shouldShowTablePaginationControls } from './table-view';
  import { formatValue, valuePolarity } from './value-format';

  /**
   * 表格(纯渲染):行与列定义 props 进,翻页/排序/表头筛选事件出,自身零状态。
   * 固定表头 + 表体滚动;固定列(left/right)以 sticky 实现;
   * 排序状态显示在列头(多列时带优先级序号);分页由壳传入页大小与总条数。
   */
  interface Props {
    /** 已解析的 main 数据槽；rows 为空时表格仍呈现表头。 */
    data: NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> };
    props: TableComponentProps;
    /** 是否呈现排序、表头筛选和分页交互;缺省 true 保持存量行为 */
    interactive?: boolean;
    /** 当前视图状态(页码/排序/表头筛选),由壳持有 */
    view: TableViewState;
    /** select 模式表头筛选候选项(壳经数据网关 fetchDimensionValues 供给),key = 列 field */
    filterOptions?: Record<string, string[]>;
    pagination?: TablePaginationState;
    selectedCell?: TableSelectedCell;
    onpage?: (pageIndex: number) => void;
    onpagesize?: (pageSize: number) => void;
    onsort?: (sort: TableSortRule[]) => void;
    onheaderfilter?: (field: string, value: TableHeaderFilterValue | null) => void;
    oncellselect?: (context: { rowIndex: number; column: TableColumn }) => void;
  }

  let {
    data,
    props,
    interactive = true,
    view,
    filterOptions = {},
    pagination,
    selectedCell,
    onpage,
    onpagesize,
    onsort,
    onheaderfilter,
    oncellselect
  }: Props = $props();

  const columnLayout = $derived(buildTableColumnLayout(props.columns, data.main.fields));
  const leaves = $derived(columnLayout.leaves);
  const rows = $derived(alignTableRows(data, props.rowKey));
  const columnWidthTotal = $derived(
    leaves.reduce((total, column) => total + (column.width ?? 120), 0)
  );

  function columnField(column: TableColumn): string {
    return resolveField(column.field, data).field;
  }

  // 固定列的 sticky 偏移:左固定列累计其前方左固定列宽度,右固定列累计其后方右固定列宽度。
  // 无显式宽度的固定列按 120px 参与累计(与 colgroup 缺省一致,保证偏移与实际渲染吻合)
  const FALLBACK_FIXED_WIDTH = 120;
  const stickyOffsets = $derived.by(() => {
    const offsets = new Map<string, number>();
    let left = 0;
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
          : null;
    if (event.shiftKey) {
      const kept = view.sort.filter((rule) => rule.field !== field);
      onsort?.(next ? [...kept, next] : kept);
    } else {
      onsort?.(next ? [next] : []);
    }
  }

  function selectedValues(field: string): string[] {
    const value = view.headerFilters[field];
    return value?.mode === 'select' ? value.values : [];
  }

  function toggleFilterValue(field: string, option: string) {
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
    onheaderfilter?.(field, from || to ? { mode: 'dateRange', from, to } : null);
  }

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
        const numeric = numericValue(alignedFieldValue(column.field, data, row));
        if (numeric !== undefined) maximum = Math.max(maximum, Math.abs(numeric));
      }
      maxima.set(columnField(column), maximum);
    }
    return maxima;
  });

  function rateBarWidth(
    column: TableColumn,
    value: string | number | boolean | null | undefined
  ): number {
    const numeric = numericValue(value);
    const maximum = rateBarMaxima.get(columnField(column)) ?? 0;
    if (numeric === undefined || maximum === 0) return 0;
    return Math.min(100, (Math.abs(numeric) / maximum) * 100);
  }

  function numericValue(
    value: string | number | boolean | null | undefined
  ): number | undefined {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
</script>

<div class:fit-container={props.fit === 'container'} class="table-widget">
  {#if props.title || props.subtitle}
    <div class="table-heading">
      {#if props.title}<h3>{props.title}</h3>{/if}
      {#if props.subtitle}
        <div class="subtitle"><span aria-hidden="true">*</span>{props.subtitle}</div>
      {/if}
    </div>
  {/if}
  <div class="scroll">
    <table>
      <colgroup>
        {#each leaves as column (columnField(column))}
          <col style={columnStyle(column)} />
        {/each}
      </colgroup>
      <thead>
        {#each columnLayout.headerRows as headerRow, rowIndex (rowIndex)}
          <tr>
            {#each headerRow as cell (cell.key)}
              {#if cell.kind === 'group'}
                <th
                  class="group-header"
                  colspan={cell.colspan}
                  rowspan={cell.rowspan}
                  style={`top: ${rowIndex * 40}px;`}
                >
                  {cell.title}
                </th>
              {:else}
                {@const column = cell.column}
                <th
                  class:align-right={column.align === 'right'}
                  class:fixed={!!column.fixed}
                  colspan={cell.colspan}
                  rowspan={cell.rowspan}
                  style={`${cellStyle(column)} top: ${rowIndex * 40}px;`}
                >
                  <div class="head">
                    {#if interactive && props.pagination?.mode !== 'query' && column.sortable}
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
                            {rule.direction === 'asc' ? '↑' : '↓'}{#if view.sort.length > 1}<sup>{sortIndexOf.get(columnField(column))! + 1}</sup>{/if}
                          </span>
                        {:else}
                          <span class="sort-hint" aria-hidden="true">⇅</span>
                        {/if}
                      </button>
                    {:else}
                      <span>{cell.title}</span>
                    {/if}

                    {#if interactive && props.pagination?.mode !== 'query' && column.filterable}
                      <details class="filter">
                        <summary class:active={hasActiveFilter(columnField(column))} title="表头筛选">▼</summary>
                        <div class="menu">
                          {#if column.filterable.mode === 'select'}
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
                              <span class="hint">候选项加载中…</span>
                            {/each}
                          {:else}
                            {@const range = dateRangeOf(columnField(column))}
                            <div class="range">
                              <input
                                type="date"
                                value={range.from}
                                onchange={(e) =>
                                  emitDateRange(columnField(column), e.currentTarget.value, range.to)}
                              />
                              <span class="sep">至</span>
                              <input
                                type="date"
                                value={range.to}
                                onchange={(e) =>
                                  emitDateRange(columnField(column), range.from, e.currentTarget.value)}
                              />
                            </div>
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
        {#each rows as row, i (i)}
          <tr>
            {#each leaves as column (columnField(column))}
              {@const resolved = resolveField(column.field, data)}
              {@const rawValue = alignedFieldValue(column.field, data, row)}
              {@const polarity = valuePolarity(rawValue)}
              <td
                class:align-right={column.align === 'right'}
                class:fixed={!!column.fixed}
                class:emphasized={column.emphasis === 'strong'}
                class:selected={isSelected(i, column)}
                class:danger={isDanger(column, rawValue)}
                class:negative={column.visual === 'signed' && polarity === 'negative'}
                class:positive={column.visual === 'signed' && polarity === 'positive'}
                style={cellStyle(column)}
              >
                {#if column.selection && interactive}
                  <button
                    type="button"
                    class="selectable-cell"
                    aria-pressed={isSelected(i, column)}
                    onclick={() => oncellselect?.({ rowIndex: i, column })}
                  >
                    <span class="cell-stack">
                      <span>{formatValue(rawValue, resolved.format)}</span>
                    </span>
                  </button>
                {:else if column.visual === 'rateBar'}
                  <span class="rate-cell">
                    <span
                      aria-hidden="true"
                      class="rate-bar"
                      style={`width: ${rateBarWidth(column, rawValue)}%;`}
                    ></span>
                    <span class="cell-value">{formatValue(rawValue, resolved.format)}</span>
                  </span>
                {:else}
                  <span class="cell-stack">
                    <span>{formatValue(rawValue, resolved.format)}</span>
                    {#if column.secondaryField}
                      {@const secondary = resolveField(column.secondaryField, data)}
                      <small>
                        {formatValue(alignedFieldValue(column.secondaryField, data, row), secondary.format)}
                      </small>
                    {/if}
                    {#if column.badgeField}
                      {@const badge = resolveField(column.badgeField, data)}
                      <small class="cell-badge">
                        {formatValue(alignedFieldValue(column.badgeField, data, row), badge.format)}
                      </small>
                    {/if}
                  </span>
                {/if}
              </td>
            {/each}
          </tr>
        {:else}
          <tr>
            <td class="empty-row" colspan={Math.max(leaves.length, 1)}>暂无数据</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if props.pagination && props.pagination.mode !== 'none' && interactive && pagination}
    <div class="pager">
      <span class="total">总条数： <span>{pagination.totalCount}</span></span>
      {#if showPaginationControls}
        <div class="pager-actions">
          <details class="page-size-select">
            <summary aria-label={`每页 ${pagination.pageSize} 条`}>
              <span>{pagination.pageSize}</span>
              <span aria-hidden="true" class="page-size-arrow"></span>
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
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="M10.4 3.4 5.8 8l4.6 4.6" />
            </svg>
          </button>
          {#if (props.pagination.mode === 'query' || props.pagination.numbered) && numberedPages.length > 0}
            {#each numberedPages as item, itemIndex (`${item}:${itemIndex}`)}
              {#if item === '…'}
                <span class="ellipsis">…</span>
              {:else}
                <button
                  type="button"
                  class="page-button"
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
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="m5.6 3.4 4.6 4.6-4.6 4.6" />
            </svg>
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .table-widget {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 19px 19px 11px;
    background: #fff;
    border-radius: 16px;
    font-size: 14px;
  }
  .table-heading {
    display: flex;
    min-height: 30px;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }
  h3 {
    margin: 0;
    color: #121e3b;
    font-size: 20px;
    font-weight: 600;
    line-height: 30px;
  }
  .subtitle {
    color: #595959;
    font-size: 12px;
    font-weight: 400;
    line-height: 22px;
    white-space: nowrap;
  }
  .subtitle span {
    margin-right: 4px;
    color: #f21e1e;
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
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    box-sizing: border-box;
    height: 42px;
    background: #f1f4ff;
    text-align: left;
    font-weight: 500;
    color: #595959;
    padding: 8px 10px;
    border-right: 1px solid #d8deeb;
    border-bottom: 1px solid #d8deeb;
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
  tbody td {
    height: 40px;
    padding: 8px 10px;
    border-right: 1px solid #edf0f5;
    border-bottom: 1px solid #edf0f5;
    background: #fff;
    color: #191919;
    white-space: nowrap;
  }
  tbody td.danger {
    color: #f23030;
  }
  tbody td.selected {
    color: #1476ff;
    background: rgb(33 111 240 / 0.05);
    box-shadow: inset 0 0 0 1px #1476ff;
  }
  tbody td.emphasized {
    font-weight: 600;
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  tbody td.positive {
    color: #52c41a;
  }
  tbody td.negative {
    color: #f5222d;
  }
  .selectable-cell {
    width: 100%;
    padding: 2px 6px;
    color: #191919;
    background: rgb(33 111 240 / 0.05);
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
    color: #1476ff;
    border-color: #1476ff;
    outline: none;
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
    position: absolute;
    z-index: 10;
    top: calc(100% + 4px);
    left: 0;
    min-width: 160px;
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
    margin-top: 8px;
    color: #191919;
    font-size: 14px;
    line-height: 1;
  }
  .pager-actions {
    display: flex;
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
    margin-right: 16px;
  }
  .page-size-select summary {
    box-sizing: border-box;
    display: flex;
    min-width: 70px;
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
  .page-size-select summary::-webkit-details-marker {
    display: none;
  }
  .page-size-select summary:hover {
    border-color: #999;
  }
  .page-size-select summary:active {
    border-color: #1476ff;
  }
  .page-size-select summary:focus-visible {
    outline: 2px solid rgb(20 118 255 / 0.28);
    outline-offset: 1px;
  }
  .page-size-arrow {
    position: relative;
    width: 32px;
    height: 30px;
  }
  .page-size-arrow::after {
    position: absolute;
    top: 11px;
    left: 11px;
    width: 6px;
    height: 6px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    content: '';
    transform: rotate(45deg);
    transform-origin: 65% 65%;
    transition: transform 120ms ease;
  }
  .page-size-select[open] .page-size-arrow::after {
    transform: rotate(225deg);
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
  }
  .page-button:hover,
  .page-button:active {
    background: #f5f5f5;
    color: #191919;
  }
  .page-button:active {
    background: #e6e6e6;
  }
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
  .pager-nav svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.2;
  }
  .pager-prev {
    margin-right: 8px;
  }
  .pager-next {
    margin-left: 4px;
  }
  .pager-nav:hover:not(:disabled),
  .pager-nav:active:not(:disabled) {
    color: #1476ff;
  }
  .pager-nav:disabled {
    color: rgb(16 16 16 / 0.3);
    cursor: not-allowed;
  }
  .page-button.current {
    background: #f5f5f5;
    color: #191919;
    font-weight: 700;
  }
  /* 兼容旧分页契约：视觉升级不要求调用方切换分页状态模型。 */
  .pager-actions :global(.page-size) {
    box-sizing: border-box;
    display: inline-flex;
    min-width: 70px;
    height: 32px;
    align-items: center;
    margin-right: 16px;
    padding: 0 12px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    background: #fff;
    color: #191919;
    white-space: nowrap;
  }
  .pager-actions > button:not(.page-button):not(.pager-nav) {
    box-sizing: border-box;
    min-width: 32px;
    height: 32px;
    margin-right: 4px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    color: #595959;
    font: inherit;
    cursor: pointer;
  }
  .pager-actions > button:not(.page-button):not(.pager-nav):hover:not(:disabled) {
    background: #f5f5f5;
    color: #191919;
  }
  .pager-actions > button.current:not(.page-button) {
    background: #f5f5f5;
    color: #191919;
    font-weight: 700;
  }
  .pager-actions > button[aria-label]:not(.pager-nav) {
    min-width: 18px;
    padding: 0;
    border-radius: 0;
    color: #191919;
  }
  .pager-actions > button[aria-label='上一页']:not(.pager-nav) {
    margin-right: 8px;
  }
  .pager-actions > button[aria-label='下一页']:not(.pager-nav) {
    margin-left: 4px;
    margin-right: 0;
  }
  .pager-actions > button:not(.page-button):not(.pager-nav):disabled {
    color: rgb(16 16 16 / 0.3);
    cursor: not-allowed;
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
  .fit-container .scroll {
    overflow-x: hidden;
  }
  .fit-container table {
    table-layout: fixed;
  }
  .fit-container thead th,
  .fit-container tbody td {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .fit-container .cell-stack,
  .fit-container .rate-cell {
    min-width: 0;
    max-width: 100%;
  }
  .fit-container .rate-cell {
    width: 100%;
  }
</style>
