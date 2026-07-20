<script lang="ts" module>
  import type { OrderByRule, TableColumn } from '@metriccanvas/page';

  /** 表头筛选当前值:select=下拉多选值集合,dateRange=起止日期(都填妥才生效) */
  export type TableHeaderFilterValue =
    | { mode: 'select'; values: string[] }
    | { mode: 'dateRange'; from: string; to: string };

  /** 表格视图状态:由运行时/壳持有,组件只显示当前值并上抛变更(纯渲染) */
  export interface TableViewState {
    /** 当前页码(0 起);盲翻设计,不存在总页数 */
    pageIndex: number;
    /** 多列排序,数组序即优先级 */
    sort: OrderByRule[];
    /** 表头筛选当前值,key = 列 field */
    headerFilters: Record<string, TableHeaderFilterValue>;
  }
</script>

<script lang="ts">
  import type { DataSnapshot } from '@metriccanvas/page';

  /**
   * 表格(纯渲染):行与列定义 props 进,翻页/排序/表头筛选事件出,自身零状态。
   * 固定表头 + 表体滚动;固定列(left/right)以 sticky 实现;
   * 排序状态显示在列头(多列时带优先级序号);盲翻分页:快照 hasMore 为假即禁用下一页。
   */
  interface Props {
    /** 就绪的数据快照(加载/错误态由运行时统一呈现);rows 为空时表格自呈现空行提示 */
    snapshot: Extract<DataSnapshot, { status: 'ready' }>;
    /** 列定义,来自页面文档(列序即展示序) */
    columns: TableColumn[];
    /** 当前视图状态(页码/排序/表头筛选),由壳持有 */
    view: TableViewState;
    /** select 模式表头筛选候选项(壳经数据网关 fetchDimensionValues 供给),key = 列 field */
    filterOptions: Record<string, string[]>;
    onpage: (pageIndex: number) => void;
    onsort: (sort: OrderByRule[]) => void;
    onheaderfilter: (field: string, value: TableHeaderFilterValue | null) => void;
  }

  let { snapshot, columns, view, filterOptions, onpage, onsort, onheaderfilter }: Props = $props();

  // 固定列的 sticky 偏移:左固定列累计其前方左固定列宽度,右固定列累计其后方右固定列宽度。
  // 无显式宽度的固定列按 120px 参与累计(与 colgroup 缺省一致,保证偏移与实际渲染吻合)
  const FALLBACK_FIXED_WIDTH = 120;
  const stickyOffsets = $derived.by(() => {
    const offsets = new Map<string, number>();
    let left = 0;
    for (const column of columns) {
      if (column.fixed !== 'left') continue;
      offsets.set(column.field, left);
      left += column.width ?? FALLBACK_FIXED_WIDTH;
    }
    let right = 0;
    for (const column of [...columns].reverse()) {
      if (column.fixed !== 'right') continue;
      offsets.set(column.field, right);
      right += column.width ?? FALLBACK_FIXED_WIDTH;
    }
    return offsets;
  });

  function cellStyle(column: TableColumn): string {
    if (!column.fixed) return '';
    const offset = stickyOffsets.get(column.field) ?? 0;
    return `position: sticky; ${column.fixed}: ${offset}px;`;
  }

  const sortIndexOf = $derived(new Map(view.sort.map((rule, index) => [rule.field, index])));

  /**
   * 点击列头:该列 无排序→asc→desc→清除 循环;普通点击替换为单列排序,
   * Shift+点击保留其余列(先点先高,多列优先级映射 @order priority)。
   */
  function toggleSort(column: TableColumn, event: MouseEvent) {
    if (!column.sortable) return;
    const current = view.sort.find((rule) => rule.field === column.field);
    const next: OrderByRule | null =
      !current
        ? { field: column.field, direction: 'asc' }
        : current.direction === 'asc'
          ? { field: column.field, direction: 'desc' }
          : null;
    if (event.shiftKey) {
      const kept = view.sort.filter((rule) => rule.field !== column.field);
      onsort(next ? [...kept, next] : kept);
    } else {
      onsort(next ? [next] : []);
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
    onheaderfilter(field, next.length > 0 ? { mode: 'select', values: next } : null);
  }

  function dateRangeOf(field: string): { from: string; to: string } {
    const value = view.headerFilters[field];
    return value?.mode === 'dateRange' ? value : { from: '', to: '' };
  }

  /** 日期范围两端都填妥才上抛(半成品范围不触发重查),两端清空即清除 */
  function emitDateRange(field: string, from: string, to: string) {
    if (from && to) onheaderfilter(field, { mode: 'dateRange', from, to });
    else if (!from && !to) onheaderfilter(field, null);
  }

  function hasActiveFilter(field: string): boolean {
    return view.headerFilters[field] !== undefined;
  }
</script>

<div class="table-widget">
  <div class="scroll">
    <table>
      <colgroup>
        {#each columns as column (column.field)}
          <col style={column.width ? `width: ${column.width}px; min-width: ${column.width}px;` : ''} />
        {/each}
      </colgroup>
      <thead>
        <tr>
          {#each columns as column (column.field)}
            <th class:fixed={!!column.fixed} style={cellStyle(column)}>
              <div class="head">
                {#if column.sortable}
                  <button
                    type="button"
                    class="sort-toggle"
                    title="点击排序,Shift+点击追加多列排序"
                    onclick={(event) => toggleSort(column, event)}
                  >
                    <span>{column.title ?? column.field}</span>
                    {#if sortIndexOf.has(column.field)}
                      {@const rule = view.sort[sortIndexOf.get(column.field)!]}
                      <span class="sort-state" aria-label="排序:{rule.direction}">
                        {rule.direction === 'asc' ? '↑' : '↓'}{#if view.sort.length > 1}<sup>{sortIndexOf.get(column.field)! + 1}</sup>{/if}
                      </span>
                    {:else}
                      <span class="sort-hint" aria-hidden="true">⇅</span>
                    {/if}
                  </button>
                {:else}
                  <span>{column.title ?? column.field}</span>
                {/if}

                {#if column.filterable}
                  <details class="filter">
                    <summary class:active={hasActiveFilter(column.field)} title="表头筛选">▼</summary>
                    <div class="menu">
                      {#if column.filterable.mode === 'select'}
                        {#each filterOptions[column.field] ?? [] as option (option)}
                          <label class="option">
                            <input
                              type="checkbox"
                              checked={selectedValues(column.field).includes(option)}
                              onchange={() => toggleFilterValue(column.field, option)}
                            />
                            <span>{option}</span>
                          </label>
                        {:else}
                          <span class="hint">候选项加载中…</span>
                        {/each}
                      {:else}
                        {@const range = dateRangeOf(column.field)}
                        <div class="range">
                          <input
                            type="date"
                            value={range.from}
                            onchange={(e) => emitDateRange(column.field, e.currentTarget.value, range.to)}
                          />
                          <span class="sep">至</span>
                          <input
                            type="date"
                            value={range.to}
                            onchange={(e) => emitDateRange(column.field, range.from, e.currentTarget.value)}
                          />
                        </div>
                      {/if}
                      {#if hasActiveFilter(column.field)}
                        <button
                          type="button"
                          class="clear"
                          onclick={() => onheaderfilter(column.field, null)}
                        >
                          清除筛选
                        </button>
                      {/if}
                    </div>
                  </details>
                {/if}
              </div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each snapshot.rows as row, i (i)}
          <tr>
            {#each columns as column (column.field)}
              <td class:fixed={!!column.fixed} style={cellStyle(column)}>
                {row[column.field] ?? '—'}
              </td>
            {/each}
          </tr>
        {:else}
          <tr>
            <td class="empty-row" colspan={columns.length}>暂无数据</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- 盲翻分页:响应无总条数,只有"是否有下一页"(hasMore 探测),不显示总页数 -->
  <div class="pager">
    <button type="button" disabled={view.pageIndex === 0} onclick={() => onpage(view.pageIndex - 1)}>
      上一页
    </button>
    <span class="page-no">第 {view.pageIndex + 1} 页</span>
    <button type="button" disabled={!snapshot.hasMore} onclick={() => onpage(view.pageIndex + 1)}>
      下一页
    </button>
  </div>
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
    background: #fafafa;
    text-align: left;
    font-weight: 600;
    color: #52525b;
    padding: 8px 12px;
    border-bottom: 1px solid #e4e4e7;
    white-space: nowrap;
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
  tbody tr:last-child td {
    border-bottom: 0;
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
    justify-content: flex-end;
    gap: 12px;
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
  .page-no {
    color: #71717a;
  }
</style>
