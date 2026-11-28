<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Row, TableColumn, TableProps as TableComponentProps } from '@metriccanvas/page/internal';
  import { columnBindingKey } from '@metriccanvas/page/internal';
  import type { NamedDataSlots } from '../../shared/component-data';
  import { resolveField, semanticHtmlFieldPresentation } from '../../shared/component-data';
  import Skeleton from '../../shared/Skeleton.svelte';
  import { tableValueColor, valueColorStyle } from '../../shared/value-color';
  import { hasDisplayValue } from '../../shared/value-format';
  import type { TableRowTier } from './presentation';
  import {
    alignedCellArrow,
    alignedCellLoading,
    alignedFieldValue,
    tableRowColumn,
    type AlignedTableRow
  } from './rows';
  import TableCellContent from './TableCellContent.svelte';
  import TableControlIcon from './TableControlIcon.svelte';
  import { computeRateBarWidth, formatStickyCellStyle } from './table-layout';
  import type { TableExpansionControl, TableInteractionCallbacks } from './table-types';
  import type { TableSelectedCell } from './view-state';

  interface Props extends TableInteractionCallbacks {
    data: NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> };
    props: TableComponentProps;
    leaves: readonly TableColumn[];
    rows: readonly AlignedTableRow[];
    rowTiers: readonly TableRowTier[];
    rowSpans: readonly number[];
    mergedColumnField?: string;
    expandable: boolean;
    expansion?: TableExpansionControl;
    expandedRow?: Snippet<[Row]>;
    validExpansionKeys: ReadonlySet<string>;
    leadingColumnCount: number;
    rowNumberOffset: number;
    rowNumberStyle: string;
    stickyOffsets: ReadonlyMap<string, number>;
    rateBarMaxima: ReadonlyMap<string, number>;
    loading: boolean;
    bodyLoading: boolean;
    interactive: boolean;
    staticExport: boolean;
    selectedCell?: TableSelectedCell;
    onemptyretry?: () => void;
  }

  let {
    data,
    props,
    leaves,
    rows,
    rowTiers,
    rowSpans,
    mergedColumnField,
    expandable,
    expansion,
    expandedRow,
    validExpansionKeys,
    leadingColumnCount,
    rowNumberOffset,
    rowNumberStyle,
    stickyOffsets,
    rateBarMaxima,
    loading,
    bodyLoading,
    interactive,
    staticExport,
    selectedCell,
    interactionGate,
    linkHref,
    oncellselect,
    onlink,
    onemptyretry
  }: Props = $props();

  const osTheme = $derived(props.variant !== 'reportCompact');

  function columnField(column: TableColumn): string {
    return resolveField(column.field, data).field;
  }

  function isSelected(rowIndex: number, column: TableColumn): boolean {
    return selectedCell?.rowIndex === rowIndex && selectedCell.columnField === columnField(column);
  }

  function isDanger(column: TableColumn, rawValue: unknown): boolean {
    return column.dangerValues?.includes(String(rawValue ?? '')) ?? false;
  }

  function rowKey(row: AlignedTableRow, index: number): string | number {
    if (expandable && row.kind !== 'pinnedTop' && validExpansionKeys.has(expansion?.key(row.main) ?? '')) {
      return expansion!.key(row.main)!;
    }
    return index;
  }
</script>

<tbody
  inert={loading || Boolean(data.main.progress)}
  data-variant={props.variant ?? 'default'}
  data-os-theme={osTheme ? '' : undefined}
  data-fit={props.fit}
  data-static-export={staticExport ? '' : undefined}
>
  {#each rows as row, i (rowKey(row, i))}
    {@const canExpandRow = expandable && rowTiers[i] === 'detail' && validExpansionKeys.has(expansion!.key(row.main) ?? '')}
    <tr
      class:subtotal-row={rowTiers[i] === 'subtotal'}
      class:total-row={row.kind !== 'pinnedTop' && rowTiers[i] === 'total'}
      data-pinned-top={row.kind === 'pinnedTop' ? '' : undefined}
    >
      {#if expandable}
        <td class="expand-column fixed" data-column-index="0" style="left:0">
          {#if canExpandRow}
            <button
              class="row-expand-button"
              type="button"
              aria-label={expansion!.expanded(row.main) ? '收起子表格' : '展开子表格'}
              aria-expanded={expansion!.expanded(row.main)}
              aria-controls={`${expansion!.id}-${encodeURIComponent(expansion!.key(row.main)!)}`}
              onclick={() => expansion!.toggle(row.main)}
            >
              <TableControlIcon name={expansion!.expanded(row.main) ? 'down' : 'right'} />
            </button>
          {/if}
        </td>
      {/if}
      {#if props.rowNumber}
        <td
          class:fixed={props.rowNumber.fixed === 'left'}
          data-row-number
          data-column-index={expandable ? 1 : 0}
          style={rowNumberStyle}
        >
          {row.kind === 'pinnedTop' ? '' : rowNumberOffset + (row.bodyIndex ?? i) + 1}
        </td>
      {/if}
      {#each leaves as bodyColumn, columnIndex (columnBindingKey(bodyColumn.field))}
        {@const column = tableRowColumn(bodyColumn, row, data)}
        {@const bodyField = columnField(bodyColumn)}
        <!-- 合并列上被并入上方单元格的行不渲染该列 -->
        {#if row.kind === 'pinnedTop' || bodyField !== mergedColumnField || rowSpans[i] !== 0}
          {@const resolved = resolveField(column.field, data)}
          {@const rawValue = alignedFieldValue(column.field, data, row)}
          {@const hasValue = hasDisplayValue(rawValue)}
          {@const color = tableValueColor(rawValue, column, resolved.format)}
          {@const trendArrow = alignedCellArrow(column, data, row)}
          {@const semanticPresentation = semanticHtmlFieldPresentation(
            resolved,
            rawValue,
            column.visual === 'signed' ? 'signed' : undefined
          )}
          {@const actionGate =
            row.kind === 'pinnedTop'
              ? { eligible: false, enabled: false }
              : (interactionGate?.(row.main, column) ?? { eligible: true, enabled: true })}
          {@const selectable = Boolean(hasValue && column.selection && interactive && actionGate.eligible)}
          {@const linkable = Boolean(hasValue && column.link && interactive && !column.selection && actionGate.eligible)}
          {@const overflowText =
            interactive &&
            !staticExport &&
            !selectable &&
            !linkable &&
            typeof rawValue === 'string' &&
            resolved.definition?.type === 'string' &&
            semanticPresentation === undefined}
          {@const danger = isDanger(column, rawValue)}
          {@const negative = semanticPresentation === undefined && color === 'red'}
          {@const positive = semanticPresentation === undefined && color === 'green'}
          {@const explicitColor = column.colorRule !== undefined}
          {@const rowIndex = row.bodyIndex ?? i}
          {@const selected = row.kind !== 'pinnedTop' && isSelected(rowIndex, column)}
          <td
            class:overflow-text={overflowText}
            class:align-right={column.align === 'right'}
            class:fixed={Boolean(column.fixed)}
            class:emphasized={column.emphasis === 'strong'}
            class:selectable
            class:linkable
            class:selected
            class:danger
            class:negative
            class:positive
            class:explicit-color={explicitColor}
            data-column-field={bodyField}
            data-column-index={columnIndex + leadingColumnCount}
            rowspan={row.kind !== 'pinnedTop' && bodyField === mergedColumnField ? rowSpans[i] : undefined}
            style={formatStickyCellStyle(bodyColumn, stickyOffsets)}
            style:color={column.colorRule ? valueColorStyle(color) : undefined}
          >
            <TableCellContent
              {column}
              {row}
              {rowIndex}
              {data}
              {rawValue}
              {resolved}
              {semanticPresentation}
              {trendArrow}
              rateBarPercent={computeRateBarWidth(bodyColumn, rawValue, rateBarMaxima)}
              cellLoading={!staticExport && alignedCellLoading(column.field, data, row)}
              {selectable}
              {linkable}
              {selected}
              actionEnabled={actionGate.enabled}
              {interactive}
              {staticExport}
              variant={props.variant}
              {osTheme}
              fit={props.fit}
              compoundInline={props.compoundCellLayout === 'inline'}
              {overflowText}
              {explicitColor}
              toneColor={explicitColor || positive || negative || danger}
              {linkHref}
              {oncellselect}
              {onlink}
            />
          </td>
        {/if}
      {/each}
    </tr>
    {#if canExpandRow && expandedRow && expansion!.expanded(row.main)}
      <tr class="row-expansion-row">
        <td class="row-expansion-cell" colspan={leaves.length + leadingColumnCount}>
          <div
            id={`${expansion!.id}-${encodeURIComponent(expansion!.key(row.main)!)}`}
            role="region"
            aria-label="子表格"
            class="row-expansion-content"
          >
            {@render expandedRow(row.main)}
          </div>
        </td>
      </tr>
    {/if}
  {/each}
  {#if bodyLoading}
    {#each Array(10) as _}
      <tr class="skeleton-row" aria-hidden="true">
        {#if expandable}<td class="expand-column fixed" style="left:0"><Skeleton shimmer /></td>{/if}
        {#if props.rowNumber}<td class:fixed={props.rowNumber.fixed === 'left'} style={rowNumberStyle}><Skeleton shimmer /></td>{/if}
        {#each leaves as column}
          <td class:fixed={Boolean(column.fixed)} style={formatStickyCellStyle(column, stickyOffsets)}><Skeleton width="72%" shimmer /></td>
        {/each}
      </tr>
    {/each}
  {:else if data.main.snapshot.rows.length === 0}
    <tr>
      <td class="empty-row" colspan={Math.max(leaves.length + leadingColumnCount, 1)}>
        {#snippet emptyContent()}
          <span>暂无数据</span>
          {#if onemptyretry}
            <button type="button" class="empty-retry" aria-label="重试" title="重试" onclick={onemptyretry}>
              <span aria-hidden="true">↻</span>
            </button>
          {/if}
        {/snippet}
        {#if props.variant === 'reportCompact'}
          <span class="empty-message">{@render emptyContent()}</span>
        {:else}
          <div class="empty-state">{@render emptyContent()}</div>
        {/if}
      </td>
    </tr>
  {/if}
</tbody>

<style>
  .empty-retry {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .empty-message,
  .empty-state {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  tbody td.align-right {
    text-align: right;
  }
  td.fixed {
    position: sticky;
    z-index: 1;
    background: #fff;
  }
  tbody td {
    height: var(--mc-table-row-height, 40px);
    padding: 8px 10px;
    border-right: 1px solid var(--mc-table-cell-border, #edf0f5);
    border-bottom: 1px solid var(--mc-table-cell-border, #edf0f5);
    background: #fff;
    color: #191919;
    white-space: nowrap;
  }
  tbody[data-variant='embedded'] > tr > td:not(:where(.row-expansion-cell)) {
    box-sizing: border-box;
    height: 48px;
    padding: 0 6px;
    overflow: visible;
    border-right: 0;
    line-height: 20px;
    overflow-wrap: anywhere;
    white-space: normal;
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
  td.linkable {
    cursor: pointer;
  }
  .empty-row {
    text-align: center;
    color: #71717a;
    padding: 24px 0;
  }
  tbody[data-variant='reportCompact'] > tr > td:not(:where(.row-expansion-cell)) {
    height: 42px;
    padding: 7px 8px;
    border-right: 0;
    border-bottom: 1px solid #edf0f5;
  }
  tbody[data-fit='container'] > tr > td:not(:where(.row-expansion-cell)) {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  tbody[data-fit='container'][data-variant='embedded'] > tr > td:not(:where(.row-expansion-cell)) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  tbody[data-variant='forecastMatrix'] > tr > td:not(:where(.row-expansion-cell)),
  tbody[data-variant='forecastMatrix'][data-fit='container'] > tr > td:not(:where(.row-expansion-cell)) {
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
  tbody[data-variant='forecastMatrix'] > tr.subtotal-row > td:not(:where(.row-expansion-cell)),
  tbody[data-variant='forecastMatrix'] > tr.total-row > td:not(:where(.row-expansion-cell)),
  tbody[data-variant='forecastMatrix'] > tr.subtotal-row > td:not(:where(.row-expansion-cell)).fixed,
  tbody[data-variant='forecastMatrix'] > tr.total-row > td:not(:where(.row-expansion-cell)).fixed {
    background: rgb(20 118 255 / 0.05);
    font-weight: 500;
  }
  tbody[data-os-theme][data-variant='forecastMatrix'] > tr > td.align-right {
    text-align: right;
  }
  tbody[data-os-theme] > tr > td {
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
  tbody[data-os-theme] > tr:last-child > td {
    border-bottom: 1px solid #f0f0f0;
  }
  tbody[data-os-theme] > tr > td.positive {
    color: var(--mc-color-positive, #52c41a);
  }
  tbody[data-os-theme] > tr > td.negative {
    color: var(--mc-color-negative, #f5222d);
  }
  tbody[data-os-theme] > tr > td.fixed {
    left: var(--table-sticky-left, auto) !important;
    right: var(--table-sticky-right, auto) !important;
  }
  tbody[data-os-theme] > tr > td.empty-row {
    height: auto;
    padding: 0;
    color: #191919;
    text-align: center;
  }
  tbody[data-os-theme] .empty-state {
    box-sizing: border-box;
    display: flex;
    min-height: 60px;
    padding: 60px 0;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  tbody[data-static-export] tr {
    break-inside: avoid;
  }
  tbody[data-static-export] td {
    position: static !important;
  }
  tbody[data-os-theme] > tr > .expand-column {
    width: 40px;
    min-width: 40px;
    padding: 0;
    text-align: center;
  }
  .row-expand-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .row-expand-button:focus-visible {
    outline: 2px solid #1476ff;
    outline-offset: -2px;
  }
  tbody[data-os-theme] > .row-expansion-row > .row-expansion-cell {
    padding: 16px 16px 16px 40px;
    background: #fff;
  }
  .row-expansion-content {
    width: 100%;
    max-width: max(0px, calc(var(--table-viewport-width, 100000px) - 56px));
    min-width: 0;
    container-type: inline-size;
    background: #fff;
  }
</style>
