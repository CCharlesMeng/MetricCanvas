<script lang="ts">
  import { onMount } from 'svelte';
  import ToolAction from '../ToolAction.svelte';
  import type { DraftRef } from './authoring-coordinator';
  import type { RevisionHistoryPage, RevisionHistoryEntry } from './authoring-history';
  let { list, restore }: {
    list: (cursor: string | null, snapshot?: DraftRef, signal?: AbortSignal) => Promise<RevisionHistoryPage>;
    restore: (ref: DraftRef, signal?: AbortSignal) => Promise<void>;
  } = $props();
  let entries = $state<RevisionHistoryEntry[]>([]), next = $state<string | null>(null);
  let snapshot = $state<DraftRef | undefined>(), error = $state(''), notice = $state(''), busy = $state(false);
  const controller = new AbortController();
  const cursors = new Set<string>();
  async function load() {
    if (busy) return;
    busy = true; error = '';
    try {
      const page = await list(next, snapshot, controller.signal);
      if (controller.signal.aborted) return;
      if ((page.nextCursor && (page.nextCursor === next || cursors.has(page.nextCursor))) || page.revisions.some((entry) => entries.some((prior) => prior.ref.revisionId === entry.ref.revisionId))) throw Error('历史分页出现重复修订或循环游标，已停止加载。');
      if (next) cursors.add(next);
      entries = [...entries, ...page.revisions]; snapshot = page.snapshot; next = page.nextCursor;
    } catch (cause) { if (!controller.signal.aborted) error = String(cause); }
    finally { busy = false; }
  }
  async function choose(ref: DraftRef) {
    if (busy) return; busy = true; error = ''; notice = '';
    try { await restore(ref, controller.signal); if (!controller.signal.aborted) notice = '已将历史内容作为新操作加入同步队列，原历史保留。'; }
    catch (cause) { if (!controller.signal.aborted) error = String(cause); }
    finally { busy = false; }
  }
  onMount(() => { void load(); return () => controller.abort(); });
</script>
<section aria-label="页面修订历史" class="history">
  <strong>页面历史</strong>
  <p>恢复会创建新的修订，不改写历史或已发布版本。</p>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if notice}<p role="status">{notice}</p>{/if}
  {#each entries as entry (entry.ref.revisionId)}
    <div class="entry">
      <span>{entry.revisionNumber ? `R${entry.revisionNumber}` : entry.ref.revisionId} · {entry.description ?? '说明未提供'} · {entry.origin ?? '来源未提供'} · {entry.createdAt ?? '时间未提供'}</span>
      <ToolAction disabled={busy} onclick={() => choose(entry.ref)}>恢复 {entry.ref.revisionId}</ToolAction>
    </div>
  {/each}
  {#if busy}<p role="status">正在读取或核实…</p>{/if}
  {#if next}<ToolAction disabled={busy || !!error} onclick={load}>加载更多历史</ToolAction>{/if}
</section>
<style>
  .history { padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--surface, white); }
  p { margin: 6px 0; font-size: 12px; }
  .entry { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 14px; }
  [role='alert'] { color: var(--down-strong); }
</style>
