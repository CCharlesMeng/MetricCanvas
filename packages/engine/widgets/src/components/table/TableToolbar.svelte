<svelte:options css="injected" />
<script lang="ts">
  import type { TableProps } from '@metriccanvas/page/internal';
  import { Button } from '@metriccanvas/ui';
  import TableControlIcon from './TableControlIcon.svelte';
  let { toolbar, draft = '', busy = false, canExport = true, error, ondraft, onsearch, onexport, oncancel }: {
    toolbar: TableProps['toolbar']; draft?: string; busy?: boolean; canExport?: boolean; error?: string;
    ondraft?: (query: string) => void; onsearch?: (query: string) => void;
    onexport?: () => void; oncancel?: () => void;
  } = $props();
</script>

<div class="tools" data-table-toolbar>
  {#if toolbar?.search}
    <form class="search" onsubmit={event => { event.preventDefault(); onsearch?.(draft); }}>
      <input type="search" aria-label="表格搜索" placeholder={toolbar.search.placeholder ?? '搜索表格'}
        value={draft} oninput={event => ondraft?.(event.currentTarget.value)} />
      {#if draft}<button class="clear" type="button" aria-label="清空表格搜索" title="清空" onclick={() => { ondraft?.(''); onsearch?.(''); }}><TableControlIcon name="clear" /></button>{/if}
      <button class="submit" type="submit" aria-label="搜索" title="搜索"><TableControlIcon name="search" /></button>
    </form>
  {/if}
  {#if toolbar?.export}
    <Button disabled={!canExport || !onexport} loading={busy} onclick={onexport}>{busy ? '正在导出…' : '导出'}</Button>
    {#if busy && oncancel}<Button onclick={oncancel}>取消导出</Button>{/if}
  {/if}
</div>
{#if error}<div class="error" role="alert">{error}</div>{/if}

<style>
  .tools { display:flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:8px; margin-left:auto; min-width:0; max-width:100%; font-family:Helvetica,Arial,PingFangSC-Regular,'Hiragino Sans GB','Microsoft YaHei',微软雅黑,'Microsoft JhengHei'; }
  .search { box-sizing:border-box; display:flex; align-items:center; width:240px; max-width:100%; height:32px; border:1px solid #c2c2c2; border-radius:6px; background:#fff; transition:border-color .4s; }
  .search:hover, .search:focus-within { border-color:#191919; }
  input { flex:1; box-sizing:border-box; height:100%; width:0; min-width:0; padding:0 0 0 12px; border:0; outline:none; background:transparent; color:#191919; font:inherit; font-size:14px; line-height:1; }
  input::placeholder { color:#808080; opacity:1; }
  input::-webkit-search-cancel-button { display:none; }
  .search button { position:relative; display:flex; align-items:center; justify-content:center; flex:none; box-sizing:border-box; height:30px; width:28px; padding:0; border:0; background:transparent; color:#808080; cursor:pointer; }
  .search button:hover { color:#191919; }
  .search button:focus-visible { outline:1px solid #191919; outline-offset:-2px; border-radius:4px; }
  .search .submit { justify-content:flex-start; padding-right:12px; }
  .search .clear { margin-right:-3px; }
  .clear::after { content:''; position:absolute; right:7px; top:50%; transform:translateY(-50%); height:16px; width:1px; background:#dbdbdb; }
  .clear :global(svg) { position:absolute; right:12px; }
  .error { width:100%; font-size:13px; color:var(--mc-color-danger,#b91c1c); overflow-wrap:anywhere; }
</style>
