<script lang="ts">
  import { page } from '$app/state';
  import {
    validate,
    type DataSnapshot,
    type PageSpec,
    type TypedError
  } from '@metriccanvas/spec-schema';
  import { orchestrate } from '@metriccanvas/runtime';
  import { MetricCard } from '@metriccanvas/components';
  import { specProvider, tableService } from '$lib/services';

  type PageState =
    | { phase: 'loading' }
    | { phase: 'missing'; message: string }
    | { phase: 'invalid'; errors: TypedError[] }
    | { phase: 'ready'; spec: PageSpec };

  let pageState = $state<PageState>({ phase: 'loading' });
  let snapshots = $state<Record<string, DataSnapshot>>({});

  // 页面生命周期 ②加载 → ③校验 → ⑤~⑦编排取数 → ⑧组件渲染
  $effect(() => {
    void run(page.params.pageId!);
  });

  async function run(pageId: string) {
    pageState = { phase: 'loading' };
    snapshots = {};

    let raw: unknown;
    try {
      raw = await specProvider.load(pageId);
    } catch (cause) {
      pageState = {
        phase: 'missing',
        message: cause instanceof Error ? cause.message : String(cause)
      };
      return;
    }

    const errors = validate(raw);
    if (errors.length > 0) {
      pageState = { phase: 'invalid', errors };
      return;
    }

    const spec = raw as PageSpec;
    pageState = { phase: 'ready', spec };
    await orchestrate(spec.widgets, tableService, (widgetId, snapshot) => {
      snapshots[widgetId] = snapshot;
    });
  }
</script>

{#if pageState.phase === 'loading'}
  <p class="muted">加载页面规格…</p>
{:else if pageState.phase === 'missing'}
  <div class="error-page">
    <h1>页面加载失败</h1>
    <p>{pageState.message}</p>
  </div>
{:else if pageState.phase === 'invalid'}
  <div class="error-page">
    <h1>页面规格未通过校验</h1>
    <p class="muted">修复以下错误后保存,页面会自动刷新。</p>
    <ul class="errors">
      {#each pageState.errors as error}
        <li>
          <code class="badge">{error.type}</code>
          <code class="path">{error.path}</code>
          <span>{error.message}</span>
        </li>
      {/each}
    </ul>
  </div>
{:else}
  <h1 class="page-title">{pageState.spec.title}</h1>
  <div class="grid" style="grid-template-columns: repeat({pageState.spec.layout.columns}, 1fr);">
    {#each pageState.spec.widgets as widget (widget.id)}
      {@const snapshot = snapshots[widget.id] ?? { status: 'loading' }}
      <section
        class="cell"
        style="grid-column: {widget.position.x + 1} / span {widget.position.w};
               grid-row: {widget.position.y + 1} / span {widget.position.h};"
      >
        {#if widget.title}<h2 class="cell-title">{widget.title}</h2>{/if}
        <!-- 加载/错误/空态呈现暂由壳承担,切片5(#6)下沉到运行时统一呈现;组件只接就绪快照 -->
        {#if snapshot.status === 'loading'}
          <div class="skeleton"></div>
        {:else if snapshot.status === 'error'}
          <div class="state error">查询失败:{snapshot.error.message}</div>
        {:else if snapshot.status === 'empty'}
          <div class="state">暂无数据</div>
        {:else if widget.type === 'metricCard'}
          <MetricCard {snapshot} display={widget.display} metric={widget.query.metrics[0]} />
        {/if}
      </section>
    {/each}
  </div>
{/if}

<style>
  .muted {
    color: #71717a;
  }
  .page-title {
    font-size: 20px;
    margin: 8px 0 20px;
  }
  .grid {
    display: grid;
    grid-auto-rows: 72px;
    gap: 16px;
  }
  .cell {
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
  }
  .cell-title {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: #71717a;
  }
  .skeleton {
    flex: 1;
    border-radius: 6px;
    background: linear-gradient(90deg, #f4f4f5 25%, #e4e4e7 50%, #f4f4f5 75%);
    background-size: 200% 100%;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
  .state {
    flex: 1;
    display: flex;
    align-items: center;
    color: #71717a;
    font-size: 14px;
  }
  .state.error {
    color: #b91c1c;
  }
  .error-page h1 {
    font-size: 20px;
  }
  .errors {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .errors li {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    font-size: 14px;
  }
  .badge {
    font-size: 12px;
    font-weight: 700;
    color: #b91c1c;
  }
  .path {
    font-size: 13px;
    color: #52525b;
  }
</style>
