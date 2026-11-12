<script lang="ts">
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import type { RuntimeDataGateway } from '@metriccanvas/engine';
  import document from '../../../../../../pages/capabilities/table/paged-join-progressive.json';
  import { createPagedJoinPreview } from '../../../../fixtures/query-join-gateway';
  import type { EffectiveQuery } from '@metriccanvas/page/internal';

  type Pending = { kind: 'selection' | 'supplement'; resolve(): void; reject(cause: Error): void };
  let waiting = $state.raw<Pending[]>([]);
  let holdSelection = $state(false);
  const preview = createPagedJoinPreview();
  const gateway: RuntimeDataGateway = {
    async fetchData(query, context, signal) {
      const kind = queryKind(query);
      if (kind === 'supplement' || holdSelection) await hold(kind, signal);
      return preview.dataGateway.fetchData(query, context, signal);
    }
  };
  function queryKind(query: EffectiveQuery): Pending['kind'] { return 'project-status' in query.fieldMappings ? 'supplement' : 'selection'; }
  function hold(kind: Pending['kind'], signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const entry: Pending = { kind, resolve, reject };
      waiting = [...waiting, entry];
      signal?.addEventListener('abort', () => { waiting = waiting.filter(item => item !== entry); reject(new Error('合成查询已取消')); }, {once:true});
    });
  }
  function release(kind: Pending['kind'], fail = false) {
    const entry = waiting.find(item => item.kind === kind);
    if (!entry) return;
    waiting = waiting.filter(item => item !== entry);
    if (fail) entry.reject(Object.assign(new Error('合成补充查询失败'), {code:'DQE_FORBIDDEN'}));
    else entry.resolve();
  }
</script>

<svelte:head><title>级联表格渐进补列 · 合成数据</title></svelte:head>
<aside aria-label="合成查询控制">
  <p>主查询确定当前页后先显示已就绪列；补充列返回后原位补齐。此演示不连接真实 DQE。</p>
  <label><input type="checkbox" bind:checked={holdSelection} />暂停选页请求</label>
  <button disabled={!waiting.some(item => item.kind === 'selection')} onclick={() => release('selection')}>返回选页结果</button>
  <button disabled={!waiting.some(item => item.kind === 'supplement')} onclick={() => release('supplement')}>返回下一批补列</button>
  <button disabled={!waiting.some(item => item.kind === 'supplement')} onclick={() => release('supplement', true)}>补列失败</button>
</aside>
<RuntimeView {document} dataGateway={gateway} />

<style>
  aside { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:16px 24px; background:#fff; border-bottom:1px solid #e4e4e7; }
  p { flex-basis:100%; margin:0; }
  button { padding:6px 12px; font:inherit; }
</style>
