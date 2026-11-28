<svelte:options css="injected" />
<script lang="ts">
  import type { FieldValue, Row, TableColumn, TableProps as TableComponentProps } from '@metriccanvas/page/internal';
  import type { NamedDataSlots, ResolvedField, SemanticHtmlFieldPresentation } from '../../shared/component-data';
  import SemanticHtml from '../../shared/SemanticHtml.svelte';
  import Skeleton from '../../shared/Skeleton.svelte';
  import OverflowCellText from './OverflowCellText.svelte';
  import { alignedCellLoading, alignedCellText, type AlignedTableRow } from './rows';

  interface Props {
    column: TableColumn;
    row: AlignedTableRow;
    rowIndex: number;
    data: NamedDataSlots;
    rawValue: FieldValue | undefined;
    resolved: ResolvedField;
    semanticPresentation: SemanticHtmlFieldPresentation | undefined;
    trendArrow: string;
    rateBarPercent: number;
    cellLoading: boolean;
    selectable: boolean;
    linkable: boolean;
    selected: boolean;
    actionEnabled: boolean;
    interactive: boolean;
    staticExport: boolean;
    variant: TableComponentProps['variant'];
    osTheme: boolean;
    fit: TableComponentProps['fit'];
    compoundInline: boolean;
    overflowText: boolean;
    explicitColor: boolean;
    toneColor: boolean;
    linkHref?: (row: Row, column?: TableColumn) => string | undefined;
    oncellselect?: (context: { rowIndex: number; column: TableColumn; row?: Row }) => void;
    onlink?: (context: { rowIndex: number; column: TableColumn; row: Row }, event: MouseEvent) => void;
  }

  let {
    column,
    row,
    rowIndex,
    data,
    rawValue,
    resolved,
    semanticPresentation,
    trendArrow,
    rateBarPercent,
    cellLoading,
    selectable,
    linkable,
    selected,
    actionEnabled,
    interactive,
    staticExport,
    variant,
    osTheme,
    fit,
    compoundInline,
    overflowText,
    explicitColor,
    toneColor,
    linkHref,
    oncellselect,
    onlink
  }: Props = $props();

  const styleAttrs = $derived({
    'data-variant': variant ?? 'default',
    'data-os-theme': osTheme ? '' : undefined,
    'data-fit': fit,
    'data-compound-inline': compoundInline ? '' : undefined,
    'data-overflow-text': overflowText ? '' : undefined,
    'data-explicit-color': explicitColor ? '' : undefined,
    'data-tone-color': toneColor ? '' : undefined
  });

  function handleLinkKeydown(event: KeyboardEvent & { currentTarget: HTMLAnchorElement }) {
    if (actionEnabled && !linkHref?.(row.main, column) && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  function handleLinkClick(event: MouseEvent) {
    if (actionEnabled) onlink?.({ rowIndex, column, row: row.main }, event);
    else event.preventDefault();
  }
</script>

{#snippet arrowGlyph()}
  <span class="cell-trend-arrow" role="img" aria-label={trendArrow === '↑' ? '上箭头' : '下箭头'}>
    <span class="cell-trend-arrow-text">{trendArrow}</span>
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 14V2M3 7l5-5 5 5" transform={trendArrow === '↓' ? 'rotate(180 8 8)' : undefined} />
    </svg>
  </span>
{/snippet}

{#snippet primaryValue()}
  <span class="cell-trend-value" class:with-trend-arrow={Boolean(trendArrow)}>
    {#if trendArrow && column.arrowRule?.position !== 'after'}{@render arrowGlyph()}{' '}{/if}<span class="cell-trend-text">{alignedCellText(column.field, data, row, column.enumValues, column.unit, column.absoluteDisplayLimit)}</span>{#if trendArrow && column.arrowRule?.position === 'after'}{' '}{@render arrowGlyph()}{/if}
  </span>
{/snippet}

{#snippet supplementaryFields()}
  {#if column.secondaryField}
    {#if row.kind === 'pinnedTop' && !staticExport && alignedCellLoading(column.secondaryField, data, row)}
      <Skeleton width="2.5rem" shimmer />
    {:else}
      <small>{alignedCellText(column.secondaryField, data, row)}</small>
    {/if}
  {/if}
  {#if column.badgeField}
    {#if row.kind === 'pinnedTop' && !staticExport && alignedCellLoading(column.badgeField, data, row)}
      <Skeleton width="2rem" shimmer />
    {:else}
      <small class="cell-badge">{alignedCellText(column.badgeField, data, row)}</small>
    {/if}
  {/if}
{/snippet}

{#if cellLoading}
  {#if row.kind === 'pinnedTop'}
    <div class="cell-stack pending-cell-stack" {...styleAttrs}>
      <Skeleton width="72%" shimmer />
      {@render supplementaryFields()}
    </div>
  {:else}
    <Skeleton width="72%" shimmer />
  {/if}
{:else if selectable}
  <button
    type="button"
    class="selectable-cell"
    {...styleAttrs}
    aria-pressed={selected}
    disabled={!actionEnabled}
    onclick={() => oncellselect?.({ rowIndex, column, row: row.main })}
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
        <span class="cell-primary-value">{@render primaryValue()}</span>
      {/if}
      {@render supplementaryFields()}
    </span>
  </button>
{:else if linkable}
  <a
    href={actionEnabled ? linkHref?.(row.main, column) : undefined}
    aria-disabled={!actionEnabled}
    role={linkHref?.(row.main, column) ? undefined : 'button'}
    tabindex={!actionEnabled ? -1 : linkHref?.(row.main, column) ? undefined : 0}
    class="link-cell"
    {...styleAttrs}
    onkeydown={handleLinkKeydown}
    onclick={handleLinkClick}
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
        <span class="cell-primary-value">{@render primaryValue()}</span>
      {/if}
      {@render supplementaryFields()}
    </span>
  </a>
{:else if column.visual === 'rateBar' && semanticPresentation === undefined}
  <div class="cell-stack" {...styleAttrs}>
    <span class="rate-cell">
      <span aria-hidden="true" class="rate-bar" style={`width: ${rateBarPercent}%;`}></span>
      <span class="cell-value">{@render primaryValue()}</span>
    </span>
    {@render supplementaryFields()}
  </div>
{:else}
  <div class="cell-stack" {...styleAttrs}>
    {#if semanticPresentation}
      <SemanticHtml
        source={semanticPresentation.source}
        format={semanticPresentation.format}
        visual={semanticPresentation.visual}
        inline
      />
    {:else}
      <span class="cell-primary-value">
        {#if typeof rawValue === 'string' && resolved.definition?.type === 'string'}
          <OverflowCellText
            text={alignedCellText(column.field, data, row, column.enumValues, column.unit, column.absoluteDisplayLimit)}
            enabled={interactive && !staticExport}
          />
        {:else}
          {@render primaryValue()}
        {/if}
      </span>
    {/if}
    {@render supplementaryFields()}
  </div>
{/if}

<style>
  .selectable-cell {
    width: 100%;
    padding: 2px 0;
    color: inherit;
    background: transparent;
    border: 0;
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
  .cell-trend-value.with-trend-arrow {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    gap: 0.25em;
    line-height: 1;
  }
  .selectable-cell .cell-trend-value.with-trend-arrow,
  .link-cell .cell-trend-value.with-trend-arrow {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .cell-trend-arrow {
    position: relative;
    display: inline-flex;
    flex: none;
    width: 1em;
    height: 1em;
  }
  .cell-trend-arrow svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .cell-trend-arrow-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .cell-stack {
    display: inline-flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }
  .pending-cell-stack {
    display: flex;
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
  .cell-stack[data-compound-inline],
  [data-compound-inline] .cell-stack {
    align-items: center;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cell-stack[data-compound-inline] small,
  [data-compound-inline] .cell-stack small {
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
  .cell-stack[data-variant='embedded'],
  [data-variant='embedded'] .cell-stack,
  [data-variant='embedded'] .cell-primary-value,
  .link-cell[data-variant='embedded'] {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: visible;
    line-height: 20px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .link-cell[data-variant='embedded'] {
    color: #191919;
  }
  .cell-stack[data-variant='forecastMatrix'],
  [data-variant='forecastMatrix'] .cell-stack,
  [data-variant='forecastMatrix'] .cell-primary-value {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: visible;
    line-height: 20px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .cell-stack[data-fit='container'],
  [data-fit='container'] .cell-stack,
  [data-fit='container'] .rate-cell {
    min-width: 0;
    max-width: 100%;
  }
  [data-fit='container'] .rate-cell {
    width: 100%;
  }
  .cell-stack[data-os-theme],
  [data-os-theme] .cell-stack,
  [data-os-theme] .cell-primary-value,
  .link-cell[data-os-theme] {
    line-height: 21px;
    overflow-wrap: break-word;
  }
  .cell-stack[data-overflow-text] {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  [data-overflow-text] .cell-primary-value {
    display: block;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  .selectable-cell[data-os-theme] {
    padding: 0;
    border: 0;
    border-radius: 0;
  }
  .link-cell[data-os-theme] {
    color: #191919;
  }
  .selectable-cell[data-explicit-color],
  .link-cell[data-explicit-color],
  [data-explicit-color] .cell-primary-value,
  .link-cell[data-os-theme][data-tone-color] {
    color: inherit;
  }
</style>
