<script lang="ts">
  import SelectAllOptions from './SelectAllOptions.svelte';
  import { placeholderOptionsLast } from './candidate-order';
  import type { TableColumnCandidates } from './view-state';
  let { field, snapshot, selected, all = false, showSelectAll = false, showSearch = false, onchange, onselectall, onsearch, onmore, onretry }: {
    field: string; snapshot?: TableColumnCandidates; selected: (string | number)[];
    onchange: (value: string | number) => void;
    showSelectAll?: boolean;
    showSearch?: boolean;
    all?: boolean;
    onselectall: (values: (string | number)[], all: boolean) => void;
    onsearch?: (field: string, query: string) => void;
    onmore?: (field: string) => void; onretry?: (field: string) => void;
  } = $props();
  const key = (value: string | number) => JSON.stringify([typeof value, value]);
  const complete = $derived((snapshot?.status === 'ready' || snapshot?.status === 'empty') && !snapshot.search && snapshot.totalCount === snapshot.candidates.length);
  const missing = $derived(all ? [] : selected.filter(value => !snapshot?.candidates.some(c => c.value === value)));
  const options = $derived(placeholderOptionsLast([
    ...missing.map(value => ({ value, label: String(value), missing: true })),
    ...(snapshot?.candidates ?? []).map(candidate => ({ ...candidate, missing: false }))
  ], candidate => candidate.label));
  const limited = $derived(snapshot?.status === 'error' && snapshot.error?.code === 'DQE_CANDIDATE_LIMIT_EXCEEDED');
  function continueCandidates(event: Event) {
    if (snapshot?.status !== 'ready' || snapshot.candidates.length >= (snapshot.totalCount ?? 0)) return;
    const list = event.currentTarget as HTMLDivElement;
    if (list.scrollTop > 0 && list.scrollHeight - list.clientHeight - list.scrollTop <= 1) onmore?.(field);
  }
</script>
<div class="candidates">
  {#if showSearch}
    <input type="search" aria-label="搜索筛选候选值" placeholder="搜索选项" disabled={limited}
      value={snapshot?.search ?? ''} oninput={event => onsearch?.(field, event.currentTarget.value)} />
  {/if}
  {#if showSelectAll && !snapshot?.search}
    <SelectAllOptions values={snapshot?.candidates.map(candidate => candidate.value) ?? []} {selected} {all}
      disabled={!complete && !all} onchange={onselectall} />
  {/if}
  {#key snapshot?.search}
  <div class="list" onscroll={continueCandidates}>
    {#each options as candidate (key(candidate.value))}
      <label class="candidate candidate-option" class:selected={candidate.missing}>
        <input type="checkbox" checked={candidate.missing || all || selected.includes(candidate.value)} disabled={all && !complete} onchange={() => onchange(candidate.value)} />
        <span>{candidate.label}{#if candidate.missing}{' '}<small>已选{#if complete || snapshot?.status === 'empty' && !snapshot.search}，当前条件下无匹配{/if}</small>{/if}</span>
      </label>
    {/each}
  </div>
  {/key}
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
  {:else if !snapshot}
    <span role="status">打开筛选后加载候选项</span>
  {/if}
</div>
<style>
  .candidates { min-width: 0; min-height: 0; display: flex; flex-direction: column; flex: 0 1 auto; gap: 8px; font-weight: normal; }
  .candidates > * { flex-shrink: 0; }
  input[type="search"] { width: 0; min-width: 100%; box-sizing: border-box; height: 32px; padding: 0 8px; border: 1px solid #c2c2c2; border-radius: 6px; color: #191919; font: inherit; }
  .list { min-height: 0; max-height: 240px; flex: 0 1 auto; overflow: auto; }
  .candidate { display: flex; align-items: center; gap: 8px; padding: 6px 2px; }
  .candidate span { overflow-wrap: anywhere; white-space: normal; min-width: 0; }
  .candidate input { flex: 0 0 auto; }
  .selected { border-bottom: 1px solid #eee; }
  small, [role="status"] { color: #666; font-size: 12px; }
  button { padding: 6px 10px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; }
</style>
