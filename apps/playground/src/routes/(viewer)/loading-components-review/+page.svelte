<script lang="ts">
  import { Button } from '@metriccanvas/ui';
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { dataGateway, aiSummary } from '$lib/services';
  import { dashboard, report } from '../../../../fixtures/loading-review-documents';

  let replay = $state(0);
</script>

<svelte:head><title>全部组件加载总览 · MetricCanvas</title></svelte:head>
<div class="review-tools">
  <h1>全部组件加载总览</h1>
  <Button onclick={() => replay += 1}>重新播放全部加载</Button>
</div>
{#key replay}
  <section aria-label="Dashboard 组件" data-review-surface="dashboard">
    <RuntimeView document={dashboard} {dataGateway} {aiSummary} />
  </section>
  <section aria-label="Report 组件" data-review-surface="report">
    <RuntimeView document={report} {dataGateway} {aiSummary} />
  </section>
{/key}

<style>
  .review-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 24px; padding: 20px 24px; border-bottom: 1px solid #e4e4e7; background: #fff; }
  h1 { margin: 0; font-size: 20px; }
  section { min-width: 0; }
</style>
