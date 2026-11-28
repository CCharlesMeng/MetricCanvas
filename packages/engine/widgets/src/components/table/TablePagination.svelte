<svelte:options css="injected" />
<script lang="ts">
  import { DEFAULT_NULL_TEXT } from '../../shared/value-format';
  import { tableFilterPopover } from './filter-popover';
  import TableControlIcon from './TableControlIcon.svelte';
  import { computePageWindow } from './table-layout';
  import { shouldShowTablePaginationControls, type TablePaginationState } from './view-state';

  interface Props {
    pagination: TablePaginationState;
    pageIndex: number;
    loading: boolean;
    hasProgress: boolean;
    osTheme: boolean;
    onpage?: (pageIndex: number) => void;
    onpagesize?: (pageSize: number) => void;
  }

  let { pagination, pageIndex, loading, hasProgress, osTheme, onpage, onpagesize }: Props = $props();

  const pageSizeOptions = [10, 20, 50] as const;

  const totalPages = $derived(Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize)));
  const numberedPages = $derived(totalPages > 0 ? computePageWindow(pageIndex + 1, totalPages) : []);
  const showPaginationControls = $derived(shouldShowTablePaginationControls(pagination.totalCount, pagination.pageSize));

  function closePageSizeMenu(event: MouseEvent) {
    (event.currentTarget as HTMLElement | null)?.closest('details')?.removeAttribute('open');
  }

  function selectPageSize(event: MouseEvent, pageSize: number) {
    closePageSizeMenu(event);
    if (pageSize !== pagination.pageSize) onpagesize?.(pageSize);
  }

  function jumpToPage(input: HTMLInputElement) {
    const requested = Number(input.value.trim());
    if (!input.value.trim() || !Number.isSafeInteger(requested)) {
      input.value = String(pageIndex + 1);
      return;
    }
    const target = Math.max(1, Math.min(totalPages, requested)) - 1;
    input.value = String(target + 1);
    if (target !== pageIndex) onpage?.(target);
  }
</script>

<div class="pager" data-os-theme={osTheme ? '' : undefined} inert={loading}>
  <span class="total">总条数： <span>{loading && !hasProgress ? DEFAULT_NULL_TEXT : pagination.totalCount}</span></span>
  <div class="pager-actions">
    <details class="page-size-select" use:tableFilterPopover>
      <summary aria-label={`每页 ${pagination.pageSize} 条`}>
        <span>{pagination.pageSize}</span>
        <span aria-hidden="true" class="page-size-arrow"><TableControlIcon name="down" /></span>
      </summary>
      <div aria-label="每页显示数量" class="page-size-menu" role="listbox" popover="auto">
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
    {#if showPaginationControls}
      <button
        type="button"
        class="pager-nav pager-prev"
        aria-label="上一页"
        disabled={pageIndex === 0}
        onclick={() => onpage?.(pageIndex - 1)}
      >
        <TableControlIcon name="left" />
      </button>
      {#if numberedPages.length > 0}
        {#each numberedPages as item, itemIndex (`${item}:${itemIndex}`)}
          {#if item === '…'}
            <span class="ellipsis">…</span>
          {:else}
            <button
              type="button"
              class="page-button"
              class:last-page={itemIndex === numberedPages.length - 1}
              class:current={item === pageIndex + 1}
              aria-current={item === pageIndex + 1 ? 'page' : undefined}
              onclick={() => onpage?.(item - 1)}
            >{item}</button>
          {/if}
        {/each}
      {/if}
      <button
        type="button"
        class="pager-nav pager-next"
        aria-label="下一页"
        disabled={pageIndex + 1 >= totalPages}
        onclick={() => onpage?.(pageIndex + 1)}
      >
        <TableControlIcon name="right" />
      </button>
      <label class="page-jump">
        <span class="jump-label">跳至</span>
        <input
          aria-label="跳转页码"
          inputmode="numeric"
          value={pageIndex + 1}
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              jumpToPage(event.currentTarget);
            }
          }}
          onchange={(event) => jumpToPage(event.currentTarget)}
        />
        <span class="jump-suffix">页</span>
      </label>
    {/if}
  </div>
</div>

<style>
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
    flex-wrap: wrap;
    max-width: 100%;
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
  .pager[data-os-theme] .page-size-select {
    margin-left: 16px;
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
  .page-size-select summary:hover,
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
  .page-size-select summary:hover .page-size-arrow {
    color: #191919;
  }
  .page-size-select[open] .page-size-arrow {
    transform: rotate(180deg);
  }
  .page-size-menu {
    position: fixed;
    inset: auto;
    margin: 0;
    border: 0;
    z-index: 20;
    box-sizing: border-box;
    width: 70px;
    min-width: 70px;
    padding: 8px 0;
    max-width: calc(100vw - 16px);
    overflow: auto;
    border-radius: 6px;
    background: #fff;
    box-shadow: 0 2px 12px rgb(0 0 0 / 0.16);
  }
  .page-size-menu[popover]:not(:popover-open) {
    display: none;
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
  .page-button:hover:not(.current) {
    font-weight: 600;
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
  .page-jump {
    display: inline-flex;
    align-items: center;
    height: 32px;
    white-space: nowrap;
  }
  .jump-label {
    padding-left: 16px;
    margin-right: 8px;
  }
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
  .page-jump input:hover,
  .page-jump input:focus {
    border-color: #191919;
  }
  .jump-suffix {
    padding-left: 4px;
    margin-right: 8px;
  }
</style>
