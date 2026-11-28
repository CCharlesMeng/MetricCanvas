<svelte:options css="injected" />
<script lang="ts">
  import type { TableColumn, TableProps as TableComponentProps } from '@metriccanvas/page/internal';
  import type { NamedDataSlots } from '../../shared/component-data';
  import { resolveField } from '../../shared/component-data';
  import type { TableColumnLayout } from './columns';
  import TableControlIcon from './TableControlIcon.svelte';
  import TableHeaderFilter from './TableHeaderFilter.svelte';
  import { computeNextTableSort, formatStickyCellStyle } from './table-layout';
  import type { TableHeaderFilterSource } from './table-types';
  import type { TableSortRule, TableViewState } from './view-state';

  interface Props {
    data: NamedDataSlots;
    props: TableComponentProps;
    columnLayout: TableColumnLayout;
    leaves: readonly TableColumn[];
    expandable: boolean;
    leadingColumnCount: number;
    rowNumberStyle: string;
    headerRowHeight: number;
    stickyOffsets: ReadonlyMap<string, number>;
    interactive: boolean;
    wrapHeaders: boolean;
    staticExport: boolean;
    view: TableViewState;
    sortReset?: readonly TableSortRule[];
    filterSource: TableHeaderFilterSource;
    onsort?: (sort: TableSortRule[]) => void;
  }

  let {
    data,
    props,
    columnLayout,
    leaves,
    expandable,
    leadingColumnCount,
    rowNumberStyle,
    headerRowHeight,
    stickyOffsets,
    interactive,
    wrapHeaders,
    staticExport,
    view,
    sortReset,
    filterSource,
    onsort
  }: Props = $props();

  const osTheme = $derived(props.variant !== 'reportCompact');
  const reportCompact = $derived(props.variant === 'reportCompact');
  const sortIndexOf = $derived(new Map(view.sort.map((rule, index) => [rule.field, index])));

  function columnField(column: TableColumn): string {
    return resolveField(column.field, data).field;
  }

  function headerTop(rowIndex: number): number {
    return rowIndex * headerRowHeight;
  }

  function toggleSort(column: TableColumn, event: MouseEvent) {
    const field = columnField(column);
    if (!column.sortable || view.pausedFields?.includes(field)) return;
    onsort?.(computeNextTableSort(view.sort, field, event.shiftKey, Boolean(sortReset)));
  }
</script>

<thead
  data-variant={props.variant ?? 'default'}
  data-os-theme={osTheme ? '' : undefined}
  data-fit={props.fit}
  data-wrap-headers={wrapHeaders ? '' : undefined}
  data-static-export={staticExport ? '' : undefined}
>
  {#each columnLayout.headerRows as headerRow, rowIndex (rowIndex)}
    <tr>
      {#if expandable && rowIndex === 0}
        <th
          class="expand-column fixed"
          data-column-index="0"
          rowspan={columnLayout.headerRows.length}
          style="left:0;top:0"
          aria-label="展开子表格"
        ></th>
      {/if}
      {#if props.rowNumber && rowIndex === 0}
        <th
          class:fixed={props.rowNumber.fixed === 'left'}
          data-row-number
          data-column-index={expandable ? 1 : 0}
          rowspan={columnLayout.headerRows.length}
          style={`${rowNumberStyle} top: 0px;`}
        >
          <div class="head"><span>{props.rowNumber.title ?? '序号'}</span></div>
        </th>
      {/if}
      {#each headerRow as cell (cell.key)}
        {#if cell.kind === 'group'}
          <th
            scope="colgroup"
            class="group-header"
            colspan={cell.colspan}
            rowspan={cell.rowspan}
            style={`top: ${headerTop(rowIndex)}px;`}
          >
            {cell.title}
          </th>
        {:else}
          {@const column = cell.column}
          {@const field = columnField(column)}
          <th
            scope="col"
            class:align-right={column.align === 'right'}
            class:fixed={Boolean(column.fixed)}
            data-column-field={field}
            data-column-index={leaves.indexOf(column) + leadingColumnCount}
            class:last-column={column === leaves[leaves.length - 1]}
            colspan={cell.colspan}
            rowspan={cell.rowspan}
            style={`${formatStickyCellStyle(column, stickyOffsets)} top: ${headerTop(rowIndex)}px;`}
          >
            <div class="head">
              {#if interactive && column.sortable}
                <button
                  type="button"
                  class="sort-toggle"
                  disabled={view.pausedFields?.includes(field)}
                  title={view.pausedFields?.includes(field) ? '搜索期间暂停该列排序，清空搜索后恢复' : '点击排序,Shift+点击追加多列排序'}
                  onclick={(event) => toggleSort(column, event)}
                >
                  <span>{cell.title}</span>
                  {#if sortIndexOf.has(field)}
                    {@const rule = view.sort[sortIndexOf.get(field)!]!}
                    <span class="sort-state" aria-label="排序:{rule.direction}">
                      {#if reportCompact}
                        {rule.direction === 'asc' ? '↑' : '↓'}
                      {:else}
                        <TableControlIcon name={rule.direction === 'asc' ? 'sortAsc' : 'sortDesc'} />
                      {/if}
                      {#if view.sort.length > 1}<sup>{sortIndexOf.get(field)! + 1}</sup>{/if}
                    </span>
                  {:else}
                    <span class="sort-hint" aria-hidden="true">
                      {#if reportCompact}⇅{:else}<TableControlIcon name="sort" />{/if}
                    </span>
                  {/if}
                </button>
              {:else}
                <span>{cell.title}</span>
              {/if}

              {#if interactive && column.filterable && !view.pausedFields?.includes(field)}
                <TableHeaderFilter
                  {column}
                  {field}
                  {data}
                  {view}
                  {reportCompact}
                  {osTheme}
                  {...filterSource}
                />
              {/if}
            </div>
          </th>
        {/if}
      {/each}
    </tr>
  {/each}
</thead>

<style>
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
  thead th.align-right {
    text-align: right;
  }
  thead th.fixed {
    z-index: 3;
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
  thead[data-variant='embedded'] > tr > th {
    box-sizing: border-box;
    height: 64px;
    padding: 0 6px;
    line-height: 20px;
  }
  thead[data-variant='embedded'] > tr > th:last-child {
    border-right: 0;
  }
  thead[data-variant='embedded'] > tr > th .head > span:first-child,
  thead[data-variant='embedded'] > tr > th .sort-toggle > span:first-child {
    overflow-wrap: normal;
    white-space: pre-line;
  }
  thead[data-variant='embedded'] > tr > th .sort-hint,
  thead[data-variant='embedded'] > tr > th .sort-state {
    opacity: 0;
  }
  thead[data-variant='embedded'] th:hover .sort-hint,
  thead[data-variant='embedded'] th:focus-within .sort-hint,
  thead[data-variant='embedded'] th:focus-within .sort-state {
    opacity: 1;
  }
  thead[data-variant='reportCompact'] > tr > th {
    padding: 5px 8px;
    border-right: 1px solid #d8deeb;
    border-bottom: 1px solid #d8deeb;
    font-size: 14px;
    line-height: 22px;
  }
  thead[data-variant='reportCompact'] > tr > th:last-child {
    border-right: 0;
  }
  thead[data-fit='container'] > tr > th {
    min-width: 0;
    overflow-wrap: normal;
    white-space: nowrap;
  }
  thead[data-wrap-headers] th {
    padding-right: 6px;
    padding-left: 6px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  thead[data-wrap-headers] .head,
  thead[data-wrap-headers] .sort-toggle {
    min-width: 0;
  }
  thead[data-wrap-headers] .sort-toggle {
    width: 100%;
  }
  thead[data-wrap-headers] .sort-toggle > span:first-child {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  thead[data-wrap-headers] .sort-state,
  thead[data-wrap-headers] .sort-hint {
    flex: none;
  }
  thead[data-variant='forecastMatrix'] > tr > th,
  thead[data-variant='forecastMatrix'] > tr > th.group-header {
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
  thead[data-os-theme] > tr > th {
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
  thead[data-os-theme] > tr > th:not(.last-column)::before {
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
  thead[data-os-theme] > tr > th.group-header {
    color: #595959;
  }
  thead[data-os-theme] .head,
  thead[data-os-theme] .sort-toggle {
    min-width: 0;
  }
  thead[data-os-theme] .head > span:first-child,
  thead[data-os-theme] .sort-toggle > span:first-child {
    min-width: 0;
    color: inherit;
    font-size: 14px;
    line-height: 21px;
    font-weight: 600;
    white-space: normal;
    overflow-wrap: break-word;
  }
  thead[data-os-theme] > tr > th .sort-toggle {
    width: auto;
    gap: 4px;
  }
  thead[data-os-theme] .head {
    gap: 0;
  }
  thead[data-os-theme][data-variant='forecastMatrix'] > tr > th .head {
    justify-content: center;
  }
  thead[data-os-theme][data-variant='forecastMatrix'] > tr > th.align-right .head {
    justify-content: flex-end;
  }
  thead[data-os-theme] > tr > th .sort-state,
  thead[data-os-theme] > tr > th .sort-hint {
    display: inline-flex;
    align-items: center;
    flex: none;
    color: #808080;
    font-size: 16px;
    line-height: 16px;
    opacity: 1;
  }
  thead[data-os-theme] > tr > th .sort-state,
  thead[data-os-theme] > tr > th .sort-toggle:hover .sort-hint {
    color: #191919;
  }
  thead[data-os-theme] > tr > th.fixed {
    left: var(--table-sticky-left, auto) !important;
    right: var(--table-sticky-right, auto) !important;
  }
  thead[data-os-theme] > tr > .expand-column {
    width: 40px;
    min-width: 40px;
    padding: 0;
    text-align: center;
  }
  thead th {
    top: var(--table-header-top, 0px) !important;
  }
  thead[data-static-export] {
    display: table-header-group;
  }
  thead[data-static-export] tr {
    break-inside: avoid;
  }
  thead[data-static-export] th {
    position: static !important;
  }
  thead[data-static-export][data-os-theme] > tr > th {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
  }
</style>
