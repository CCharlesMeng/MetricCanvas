<script lang="ts">
  import type { TableColumnCandidates } from './view-state';
  let { field, snapshot, selected, onchange, onsearch, onmore, onretry }: {
    field: string; snapshot?: TableColumnCandidates; selected: (string | number)[];
    onchange: (value: string | number) => void;
    onsearch?: (field: string, query: string) => void;
    onmore?: (field: string) => void; onretry?: (field: string) => void;
  } = $props();
  const key = (value: string | number) => JSON.stringify([typeof value, value]);
  const complete = $derived(snapshot?.status === 'ready' && !snapshot.search && snapshot.totalCount === snapshot.candidates.length);
  const missing = $derived(selected.filter(value => !snapshot?.candidates.some(c => c.value === value)));
  const limited = $derived(snapshot?.status === 'error' && snapshot.error?.code === 'DQE_CANDIDATE_LIMIT_EXCEEDED');
</script>
<div class="candidates">
  <input type="search" aria-label="搜索筛选候选值" placeholder="搜索选项" disabled={limited}
    value={snapshot?.search ?? ''} oninput={event => onsearch?.(field, event.currentTarget.value)} />
  {#each missing as value (key(value))}
    <label class="candidate candidate-option selected">
      <input type="checkbox" checked onchange={() => onchange(value)} />
      <span>{value} <small>已选{#if complete || snapshot?.status === 'empty' && !snapshot.search}，当前条件下无匹配{/if}</small></span>
    </label>
  {/each}
  <div class="list">
    {#each snapshot?.candidates ?? [] as candidate (key(candidate.value))}
      <label class="candidate candidate-option">
        <input type="checkbox" checked={selected.includes(candidate.value)} onchange={() => onchange(candidate.value)} />
        <span>{candidate.label}</span>
      </label>
    {/each}
  </div>
  {#if snapshot?.status === 'loading'}
    <span role="status">候选项加载中…</span>
  {:else if snapshot?.status === 'unavailable'}
    <span role="status">候选值能力不可用</span>
  {:else if snapshot?.status === 'error'}
    {#if limited}
      <span role="status">{snapshot.error?.message}</span>
    {:else}
      <span role="status">候选项加载失败</span>
      <button type="button" onclick={() => onretry?.(field)}>重试</button>
    {/if}
  {:else if snapshot?.status === 'empty'}
    <span role="status">没有候选项</span>
  {:else if snapshot?.status === 'ready' && snapshot.candidates.length < snapshot.totalCount!}
    <button type="button" onclick={() => onmore?.(field)}>加载更多（{snapshot.candidates.length}/{snapshot.totalCount}）</button>
  {:else if !snapshot}
    <span role="status">打开筛选后加载候选项</span>
  {/if}
</div>
<style>
  .candidates { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; font-weight: normal; }
  input[type="search"] { width: 0; min-width: 100%; box-sizing: border-box; height: 32px; padding: 0 8px; border: 1px solid #c2c2c2; border-radius: 6px; color: #191919; font: inherit; }
  .list { max-height: 240px; overflow: auto; }
  .candidate { display: flex; align-items: center; gap: 8px; padding: 6px 2px; }
  .candidate span { overflow-wrap: anywhere; white-space: normal; min-width: 0; }
  .candidate input { flex: 0 0 auto; }
  .selected { border-bottom: 1px solid #eee; }
  small, [role="status"] { color: #666; font-size: 12px; }
  button { padding: 6px 10px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; }
</style>
