<script lang="ts">
  import type {
    DqeDiagnosticRecord,
    InMemoryDqeDiagnostics
  } from '@metriccanvas/data-gateway';

  let { diagnostics }: { diagnostics: InMemoryDqeDiagnostics } = $props();
  let records = $state<readonly DqeDiagnosticRecord[]>([]);
  let selectedExecution = $state('');

  $effect(() =>
    diagnostics.subscribe((next) => {
      records = next;
      if (
        selectedExecution === '' ||
        !next.some((record) => record.executionId === selectedExecution)
      ) {
        selectedExecution = next.at(-1)?.executionId ?? '';
      }
    })
  );

  const executions = $derived.by(() => {
    const grouped = new Map<string, DqeDiagnosticRecord[]>();
    for (const record of records) {
      const items = grouped.get(record.executionId) ?? [];
      items.push(record);
      grouped.set(record.executionId, items);
    }
    return [...grouped.entries()].map(([executionId, items]) => ({
      executionId,
      items,
      latest: items.at(-1)!,
      status: items.some((item) => item.phase === 'error')
        ? 'error'
        : items.some((item) => item.phase === 'normalized')
          ? 'ready'
          : 'running'
    }));
  });

  const selectedRecords = $derived(
    records.filter((record) => record.executionId === selectedExecution)
  );
</script>

<details class="inspector">
  <summary>
    <span>查询检查器</span>
    <span class="count">{executions.length} 次逻辑查询</span>
  </summary>

  <div class="toolbar">
    <p>本地内存诊断：原始查询 → 生效查询 → 批量位置 → 单项响应 → 字段归一。</p>
    <button type="button" onclick={() => diagnostics.clear()}>清空</button>
  </div>

  {#if executions.length === 0}
    <p class="empty">尚无 DQE 查询记录。</p>
  {:else}
    <div class="workspace">
      <nav aria-label="DQE 逻辑查询">
        {#each executions as execution}
          <button
            type="button"
            class:active={execution.executionId === selectedExecution}
            onclick={() => (selectedExecution = execution.executionId)}
          >
            <strong>{execution.executionId}</strong>
            <span class:error={execution.status === 'error'}>{execution.status}</span>
            {#if execution.latest.batchId}
              <small>{execution.latest.batchId} · #{execution.latest.resultIndex ?? 0}</small>
            {/if}
          </button>
        {/each}
      </nav>

      <section aria-label="查询诊断详情">
        {#each selectedRecords as record}
          <article>
            <header>
              <strong>{record.phase}</strong>
              <span>{record.recordedAt}</span>
            </header>
            <pre>{JSON.stringify(record.detail, null, 2)}</pre>
          </article>
        {/each}
      </section>
    </div>
  {/if}
</details>

<style>
  .inspector {
    margin-top: 18px;
    overflow: hidden;
    background: #fff;
    border: 1px solid #d4d4d8;
    border-radius: 12px;
  }
  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 650;
  }
  .count,
  .toolbar p,
  header span,
  small {
    color: #71717a;
    font-size: 12px;
    font-weight: 400;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    border-top: 1px solid #e4e4e7;
    border-bottom: 1px solid #e4e4e7;
  }
  .toolbar p,
  .empty {
    margin: 0;
  }
  button {
    border: 0;
    cursor: pointer;
  }
  .toolbar button {
    padding: 5px 10px;
    color: #3f3f46;
    background: #f4f4f5;
    border-radius: 6px;
  }
  .workspace {
    display: grid;
    min-height: 280px;
    grid-template-columns: 230px minmax(0, 1fr);
  }
  nav {
    padding: 8px;
    overflow: auto;
    border-right: 1px solid #e4e4e7;
  }
  nav button {
    display: flex;
    width: 100%;
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
    padding: 9px;
    text-align: left;
    background: transparent;
    border-radius: 7px;
  }
  nav button.active {
    background: #eef2ff;
  }
  nav strong {
    color: #27272a;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }
  nav span {
    color: #15803d;
    font-size: 11px;
  }
  nav span.error {
    color: #b91c1c;
  }
  section {
    padding: 12px;
    overflow: auto;
    background: #fafafa;
  }
  article {
    margin-bottom: 12px;
    overflow: hidden;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
  }
  article header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 10px;
    border-bottom: 1px solid #e4e4e7;
  }
  pre {
    max-height: 320px;
    padding: 10px;
    margin: 0;
    overflow: auto;
    font-size: 11px;
    line-height: 1.45;
  }
  .empty {
    padding: 16px;
    color: #71717a;
  }
  @media (max-width: 760px) {
    .workspace {
      grid-template-columns: 1fr;
    }
    nav {
      max-height: 180px;
      border-right: 0;
      border-bottom: 1px solid #e4e4e7;
    }
  }
</style>
