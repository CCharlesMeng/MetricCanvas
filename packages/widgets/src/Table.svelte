<script lang="ts" module>
  export type { TableHeaderFilterValue, TableViewState } from './table-view';
  export interface TableSelectedCell {
    rowIndex: number;
    columnField: string;
  }
</script>

<script lang="ts">
  import type {
    OrderByRule,
    TableColumn,
    TableProps as TableComponentProps
  } from '@metriccanvas/page';
  import type { MainDataSlots } from './component-data';
  import { resolveField } from './component-data';
  import { buildTableColumnLayout } from './table-columns';
  import type { TableHeaderFilterValue, TableViewState } from './table-view';
  import { formatValue, valuePolarity } from './value-format';

  /**
   * 表格(纯渲染):行与列定义 props 进,翻页/排序/表头筛选事件出,自身零状态。
   * 固定表头 + 表体滚动;固定列(left/right)以 sticky 实现;
   * 排序状态显示在列头(多列时带优先级序号);盲翻分页:快照 hasMore 为假即禁用下一页。
   */
  interface Props {
    /** 已解析的 main 数据槽；rows 为空时表格仍呈现表头。 */
    data: MainDataSlots;
    props: TableComponentProps;
    /** 是否呈现排序、表头筛选和分页交互;缺省 true 保持存量行为 */
    interactive?: boolean;
    /** 当前视图状态(页码/排序/表头筛选),由壳持有 */
    view: TableViewState;
    /** select 模式表头筛选候选项(壳经数据网关 fetchDimensionValues 供给),key = 列 field */
    filterOptions?: Record<string, string[]>;
    selectedCell?: TableSelectedCell;
    onpage?: (pageIndex: number) => void;
    onsort?: (sort: OrderByRule[]) => void;
    onheaderfilter?: (field: string, value: TableHeaderFilterValue | null) => void;
    oncellselect?: (context: { rowIndex: number; column: TableColumn }) => void;
  }

  let {
    data,
    props,
    interactive = true,
    view,
    filterOptions = {},
    selectedCell,
    onpage,
    onsort,
    onheaderfilter,
    oncellselect
  }: Props = $props();

  const columnLayout = $derived(buildTableColumnLayout(props.columns, data.main.fields));
  const leaves = $derived(columnLayout.leaves);
  const rows = $derived(data.main.snapshot.rows);

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

  const sortIndexOf = $derived(new Map(view.sort.map((rule, index) => [rule.field, index])));

  /**
   * 点击列头:该列 无排序→asc→desc→清除 循环;普通点击替换为单列排序,
   * Shift+点击保留其余列(先点先高,多列优先级映射 @order priority)。
   */
  function toggleSort(column: TableColumn, event: MouseEvent) {
    if (!column.sortable) return;
    const field = columnField(column);
    const current = view.sort.find((rule) => rule.field === field);
    const next: OrderByRule | null =
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
    const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
    const sorted = [...pages]
      .filter((page) => page >= 1 && page <= total)
      .sort((a, b) => a - b);
    const result: Array<number | '…'> = [];
    for (const page of sorted) {
      const previous = result[result.length - 1];
      if (typeof previous === 'number' && page - previous > 1) result.push('…');
      result.push(page);
    }
    return result;
  }

  const totalPages = $derived(
    props.pagination?.totalCount !== undefined
      ? Math.max(
          1,
          Math.ceil(
            props.pagination.totalCount / (props.pagination.pageSize ?? 10)
          )
        )
      : 0
  );
  const numberedPages = $derived(
    totalPages > 0 ? pageWindow(view.pageIndex + 1, totalPages) : []
  );

  const rateBarMaxima = $derived.by(() => {
    const maxima = new Map<string, number>();
    for (const column of leaves) {
      if (column.visual !== 'rateBar') continue;
      let maximum = 0;
      for (const row of rows) {
        const numeric = numericValue(row[columnField(column)]);
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

<div class="table-widget">
  {#if props.title}<h3>{props.title}</h3>{/if}
  {#if props.subtitle}<div class="subtitle">{props.subtitle}</div>{/if}
  <div class="scroll">
    <table>
      <colgroup>
        {#each leaves as column (columnField(column))}
          <col style={column.width ? `width: ${column.width}px; min-width: ${column.width}px;` : ''} />
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
                            {rule.direction === 'asc' ? '↑' : '↓'}{#if view.sort.length > 1}<sup>{sortIndexOf.get(columnField(column))! + 1}</sup>{/if}
                          </span>
                        {:else}
                          <span class="sort-hint" aria-hidden="true">⇅</span>
                        {/if}
                      </button>
                    {:else}
                      <span>{cell.title}</span>
                    {/if}

                    {#if interactive && column.filterable}
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
              {@const rawValue = row[resolved.field]}
              {@const polarity = valuePolarity(rawValue)}
              <td
                class:align-right={column.align === 'right'}
                class:fixed={!!column.fixed}
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
                        {formatValue(row[secondary.field], secondary.format)}
                      </small>
                    {/if}
                    {#if column.badgeField}
                      {@const badge = resolveField(column.badgeField, data)}
                      <small class="cell-badge">
                        {formatValue(row[badge.field], badge.format)}
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

  {#if props.pagination?.mode === 'paged' && interactive}
    <div class="pager">
      {#if props.pagination.totalCount !== undefined}
        <span class="total">总条数：{props.pagination.totalCount}</span>
      {/if}
      <div class="pager-actions">
        <span class="page-size">{props.pagination.pageSize ?? 10} 条/页</span>
        <button
          type="button"
          aria-label="上一页"
          disabled={view.pageIndex === 0}
          onclick={() => onpage?.(view.pageIndex - 1)}
        >‹</button>
        {#if props.pagination.numbered && numberedPages.length > 0}
          {#each numberedPages as item, itemIndex (`${item}:${itemIndex}`)}
            {#if item === '…'}
              <span class="ellipsis">…</span>
            {:else}
              <button
                type="button"
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
          aria-label="下一页"
          disabled={totalPages > 0
            ? view.pageIndex + 1 >= totalPages
            : !data.main.snapshot.hasMore}
          onclick={() => onpage?.(view.pageIndex + 1)}
        >›</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .table-widget {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
  }
  h3 {
    margin: 0;
    color: #18181b;
    font-size: 13px;
    font-weight: 500;
  }
  .subtitle {
    color: #121e3b;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }
  /* 固定表头 + 表体滚动:thead sticky,滚动发生在容器上(纵横双向) */
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
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
    height: 40px;
    background: #fafafa;
    text-align: left;
    font-weight: 600;
    color: #52525b;
    padding: 8px 12px;
    border-bottom: 1px solid #e4e4e7;
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
    padding: 8px 12px;
    border-bottom: 1px solid #f4f4f5;
    background: #fff;
    color: #18181b;
    white-space: nowrap;
  }
  tbody td.danger {
    color: #f23030;
  }
  tbody td.selected {
    background: rgb(20 118 255 / 0.08);
    box-shadow: inset 0 0 0 1px #1476ff;
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
    padding: 4px 6px;
    color: #1476ff;
    background: transparent;
    border: 1px dashed rgb(20 118 255 / 0.42);
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
    text-align: inherit;
  }
  .selectable-cell[aria-pressed='true'] {
    background: rgb(20 118 255 / 0.1);
    border-style: solid;
    font-weight: 650;
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
    gap: 8px;
  }
  .pager-actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .total,
  .page-size {
    color: #595959;
  }
  .page-size {
    padding: 5px 8px;
    border: 1px solid #d4d4d8;
    border-radius: 6px;
  }
  .pager button {
    border: 1px solid #e4e4e7;
    background: #fff;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 13px;
    color: #18181b;
    cursor: pointer;
  }
  .pager button:disabled {
    color: #d4d4d8;
    cursor: not-allowed;
  }
  .pager button.current {
    color: #1476ff;
    background: rgb(20 118 255 / 0.08);
    border-color: #1476ff;
  }
  .ellipsis {
    padding: 0 2px;
    color: #a1a1aa;
  }
  .page-no {
    color: #71717a;
  }
</style>
