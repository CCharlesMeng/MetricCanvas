<svelte:options css="injected" />
<script lang="ts">
  import type { TableColumn } from '@metriccanvas/page/internal';
  import { currentTimeValue } from '@metriccanvas/page/internal';
  import type { NamedDataSlots } from '../../shared/component-data';
  import { resolveField } from '../../shared/component-data';
  import TextSkeleton from '../../shared/TextSkeleton.svelte';
  import ColumnCandidateOptions from './ColumnCandidateOptions.svelte';
  import SelectAllOptions from './SelectAllOptions.svelte';
  import TableControlIcon from './TableControlIcon.svelte';
  import { placeholderOptionsLast } from './candidate-order';
  import { tableFilterPopover } from './filter-popover';
  import type { TableFilterOptionStatus, TableHeaderFilterSource } from './table-types';
  import type { TableViewState } from './view-state';

  interface Props extends TableHeaderFilterSource {
    column: TableColumn;
    field: string;
    data: NamedDataSlots;
    view: TableViewState;
    reportCompact: boolean;
    osTheme: boolean;
  }

  let {
    column,
    field,
    data,
    view,
    reportCompact,
    osTheme,
    columnCandidates,
    filterOptions,
    filterOptionsStatus,
    oncandidateopen,
    oncandidatesearch,
    oncandidatemore,
    oncandidateretry,
    onheaderfilter
  }: Props = $props();

  let enumSearch = $state('');
  let dateMaximum = $state(currentTimeValue('date'));
  let dateError = $state('');

  const filterMode = $derived(column.filterable?.mode);
  const showSelectAll = $derived(column.filterable?.mode === 'select' && Boolean(column.filterable.showSelectAll));
  const showSearch = $derived(
    column.filterable?.mode === 'select' &&
      (column.filterable.showSearch ?? (!column.enumValues && view.legacyCandidateSearch === true))
  );
  const selected = $derived.by((): (string | number)[] => {
    const value = view.headerFilters[field];
    return value?.mode === 'select' ? value.values : [];
  });
  const allSelected = $derived.by(() => {
    const value = view.headerFilters[field];
    return value?.mode === 'select' && value.all === true;
  });
  const active = $derived(view.headerFilters[field] !== undefined);
  const status = $derived(filterOptionsStatus[field]);

  function filteredEnumOptions() {
    const term = showSearch ? enumSearch.trim().toLowerCase() : '';
    return placeholderOptionsLast(
      (column.enumValues ?? []).filter((option) => option.label.toLowerCase().includes(term)),
      (option) => option.label
    );
  }

  function completeFilterValues(): readonly (string | number)[] | undefined {
    if (column.enumValues) return column.enumValues.map((option) => option.value);
    if (!columnCandidates) {
      return !status || status === 'ready' ? (filterOptions[field] ?? []) : undefined;
    }
    const snapshot = columnCandidates[field];
    if (
      !snapshot ||
      !['ready', 'empty'].includes(snapshot.status) ||
      snapshot.search ||
      snapshot.totalCount !== snapshot.candidates.length
    ) {
      return undefined;
    }
    return snapshot.candidates.map((candidate) => candidate.value);
  }

  function isCompleteSelection(values: readonly (string | number)[]): boolean {
    if (column.filterable?.mode !== 'select' || !column.filterable.showSelectAll || !values.length) return false;
    const options = completeFilterValues();
    return Boolean(options?.length && options.every((value) => values.includes(value)));
  }

  function setFilterValues(values: (string | number)[], all = false) {
    onheaderfilter?.(
      field,
      all ? { mode: 'select', values, all: true } : values.length > 0 ? { mode: 'select', values } : null
    );
  }

  function toggleFilterValue(option: string | number) {
    const current = allSelected ? completeFilterValues() : selected;
    if (!current) return;
    const next = current.includes(option) ? current.filter((value) => value !== option) : [...current, option];
    setFilterValues(next, isCompleteSelection(next));
  }

  function dateRange(): { from: string; to: string } {
    const value = view.headerFilters[field];
    return value?.mode === 'dateRange' ? value : { from: '', to: '' };
  }

  /** 每次端点变更都上抛草稿,由壳回显并决定何时重查;两端清空即清除。 */
  function emitDateRange(from: string, to: string) {
    dateMaximum = currentTimeValue('date');
    dateError = from > dateMaximum || to > dateMaximum ? `日期不得晚于 ${dateMaximum}` : '';
    if (dateError) return;
    onheaderfilter?.(field, from || to ? { mode: 'dateRange', from, to } : null);
  }

  function rangeUnit(): string {
    const definition = resolveField(column.field, data).definition;
    if (definition?.type === 'money') return '元';
    if (definition?.role === 'detail') return '数值';
    return definition?.unit ?? '数值';
  }

  function numberRange(): { from: string; to: string } {
    const value = view.headerFilters[field];
    return value?.mode === 'numberRange' ? value : { from: '', to: '' };
  }

  function emitNumberRange(from: string, to: string) {
    onheaderfilter?.(field, from || to ? { mode: 'numberRange', from, to } : null);
  }

  const EMPTY_STATUS_MESSAGES: Record<string, string> = {
    denied: '无权访问候选项',
    unconfigured: '候选能力未配置',
    unavailable: '候选值能力不可用',
    error: '候选项加载失败'
  };

  function emptyStatusMessage(optionStatus: TableFilterOptionStatus | undefined): string {
    return (optionStatus && EMPTY_STATUS_MESSAGES[optionStatus]) || '没有候选项';
  }
</script>

<details
  class="filter"
  data-os-theme={osTheme ? '' : undefined}
  use:tableFilterPopover
  ontoggle={(event) => {
    if (filterMode === 'select' && !column.enumValues) oncandidateopen?.(field, event.currentTarget.open);
  }}
>
  <summary class:active title="表头筛选">
    {#if reportCompact}▼{:else}<TableControlIcon name="filter" />{/if}
  </summary>
  <div class="menu" class:select-menu={filterMode === 'select'} popover="auto">
    {#if filterMode === 'select'}
      {#if column.enumValues}
        {#if showSearch}
          <input class="enum-search" type="search" aria-label="搜索筛选候选值" placeholder="搜索选项" bind:value={enumSearch} />
        {/if}
        {#if showSelectAll && !(showSearch && enumSearch.trim())}
          <SelectAllOptions
            values={column.enumValues.map((option) => option.value)}
            {selected}
            all={allSelected}
            onchange={(values, all) => setFilterValues(values, all)}
          />
        {/if}
        <div class="option-list">
          {#each filteredEnumOptions() as option (JSON.stringify([typeof option.value, option.value]))}
            <label class="option">
              <input type="checkbox" checked={selected.includes(option.value)} onchange={() => toggleFilterValue(option.value)} />
              <span>{option.label}</span>
            </label>
          {:else}
            <span class="hint">没有候选项</span>
          {/each}
        </div>
      {:else if columnCandidates}
        <ColumnCandidateOptions
          {field}
          snapshot={columnCandidates[field]}
          {showSelectAll}
          {showSearch}
          all={allSelected}
          {selected}
          onchange={(value) => toggleFilterValue(value)}
          onselectall={(values, all) => setFilterValues(values, all)}
          onsearch={oncandidatesearch}
          onmore={oncandidatemore}
          onretry={oncandidateretry}
        />
      {:else}
        {#if showSelectAll}
          <SelectAllOptions
            values={filterOptions[field] ?? []}
            {selected}
            all={allSelected}
            disabled={!allSelected && Boolean(status) && !['ready', 'empty'].includes(status!)}
            onchange={(values, all) => setFilterValues(values, all)}
          />
        {/if}
        <div class="option-list">
          {#each placeholderOptionsLast(filterOptions[field] ?? [], String) as option (option)}
            <label class="option">
              <input
                type="checkbox"
                checked={allSelected || selected.includes(option)}
                disabled={allSelected && !completeFilterValues()}
                onchange={() => toggleFilterValue(option)}
              />
              <span>{option}</span>
            </label>
          {:else}
            {#if !status || ['idle', 'loading'].includes(status)}
              <TextSkeleton />
            {:else}
              <span class="hint">{emptyStatusMessage(status)}</span>
            {/if}
          {/each}
        </div>
      {/if}
    {:else if filterMode === 'dateRange'}
      {@const range = dateRange()}
      <div class="range">
        <input
          type="date"
          max={dateMaximum}
          onfocus={() => {
            dateMaximum = currentTimeValue('date');
            dateError = '';
          }}
          value={range.from}
          onchange={(event) => emitDateRange(event.currentTarget.value, range.to)}
        />
        <span class="sep">至</span>
        <input
          type="date"
          max={dateMaximum}
          onfocus={() => {
            dateMaximum = currentTimeValue('date');
            dateError = '';
          }}
          value={range.to}
          onchange={(event) => emitDateRange(range.from, event.currentTarget.value)}
        />
      </div>
      {#if dateError}<span class="hint" role="status">{dateError}</span>{/if}
    {:else if filterMode === 'numberRange'}
      {@const range = numberRange()}
      <div class="range">
        <input
          type="text"
          inputmode="decimal"
          aria-label="数值下限"
          placeholder="下限"
          value={range.from}
          onchange={(event) => emitNumberRange(event.currentTarget.value, range.to)}
        />
        <span class="sep">至</span>
        <input
          type="text"
          inputmode="decimal"
          aria-label="数值上限"
          placeholder="上限"
          value={range.to}
          onchange={(event) => emitNumberRange(range.from, event.currentTarget.value)}
        />
      </div>
      <span class="hint">原始单位：{rangeUnit()}</span>
    {/if}
  </div>
</details>

<style>
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
    color: #191919;
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
    overflow: hidden;
    box-sizing: border-box;
    width: max-content;
    min-width: min(160px, calc(100vw - 16px));
    max-width: min(360px, calc(100vw - 16px));
  }
  .option-list {
    min-height: 0;
    flex: 0 1 auto;
    overflow: auto;
  }
  .select-menu > :global(.candidate-option) {
    flex-shrink: 0;
  }
  .select-menu .option {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .enum-search {
    flex-shrink: 0;
    width: 0;
    min-width: 100%;
    box-sizing: border-box;
    height: 32px;
    padding: 0 8px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    color: #191919;
    font: inherit;
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
  .filter[data-os-theme] summary {
    --table-control-icon-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0 0 4px;
    color: #999;
    border-radius: 0;
  }
  .filter[data-os-theme] summary:hover {
    color: #191919;
    background: transparent;
  }
  .filter[data-os-theme] summary.active {
    color: #191919;
  }
  .filter[data-os-theme] .menu {
    box-sizing: border-box;
    padding: 4px 8px 8px;
    border: 0;
    border-radius: 6px;
    box-shadow: 0 2px 12px #0003;
    color: #191919;
    font-size: 14px;
    line-height: 21px;
  }
  .filter[data-os-theme] .menu:not(.select-menu) {
    min-width: min(270px, calc(100vw - 16px));
  }
  .filter[data-os-theme] .option,
  .filter[data-os-theme] :global(.candidate-option) {
    box-sizing: border-box;
    min-height: 28px;
    padding: 0 8px;
    border-radius: 0;
  }
  .filter[data-os-theme] .option:hover,
  .filter[data-os-theme] :global(.candidate-option:hover) {
    background: #f5f5f5;
  }
  .filter[data-os-theme] .option input,
  .filter[data-os-theme] :global(.candidate-option input) {
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
  .filter[data-os-theme] .option input:hover,
  .filter[data-os-theme] :global(.candidate-option input:hover) {
    border-color: #191919;
  }
  .filter[data-os-theme] .option input:checked,
  .filter[data-os-theme] :global(.candidate-option input:checked) {
    border-color: #1476ff;
    background: #1476ff;
    position: relative;
  }
  .filter[data-os-theme] .option input:checked::after,
  .filter[data-os-theme] :global(.candidate-option input:checked::after) {
    content: '';
    position: absolute;
    width: 7px;
    height: 4px;
    left: 3px;
    top: 3px;
    border-left: 1px solid #fff;
    border-bottom: 1px solid #fff;
    transform: rotate(-45deg);
  }
  .filter[data-os-theme] :global(.candidate-option input:indeterminate) {
    border-color: #1476ff;
    background: #1476ff;
    position: relative;
  }
  .filter[data-os-theme] :global(.candidate-option input:indeterminate::after) {
    content: '';
    position: absolute;
    width: 8px;
    height: 1px;
    left: 3px;
    top: 6px;
    background: #fff;
  }
  .filter[data-os-theme] :global(.candidate-option input:disabled) {
    opacity: .5;
    cursor: not-allowed;
  }
  .filter[data-os-theme] .option input:focus-visible,
  .filter[data-os-theme] :global(.candidate-option input:focus-visible) {
    outline: 2px solid #191919;
    outline-offset: 2px;
  }
  .filter[data-os-theme] .range {
    min-width: 0;
    padding: 8px 0;
  }
  .filter[data-os-theme] .range input {
    box-sizing: border-box;
    min-width: 0;
    width: 0;
    flex: 1;
    height: 32px;
    padding: 0 8px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    color: #191919;
    font: inherit;
  }
  .filter[data-os-theme] .range input:hover,
  .filter[data-os-theme] .range input:focus {
    border-color: #191919;
    outline: none;
  }
</style>
