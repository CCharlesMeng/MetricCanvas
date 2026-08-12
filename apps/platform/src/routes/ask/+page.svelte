<script lang="ts">
  import { RuntimeView } from '@metriccanvas/runtime-ui';
  import { createPlatformDataGateway } from '$lib/platform-data-gateway';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // 轨道 B 的数据网关浏览器适配器：只打平台服务端取数入口，数据取自仿真。
  const dataGateway = createPlatformDataGateway();
</script>

<svelte:head>
  <title>问数 · MetricCanvas</title>
</svelte:head>

<div class="ask-page">
  <div class="statusbar">
    <span class="badge">临时页面态</span>
    {#if data.assembly.ok}
      <code class="page-id">{data.assembly.pageId}</code>
      <span class="stat">组件 {data.assembly.componentCount}</span>
      <span class="stat">页面数据源 {data.assembly.dataSourceCount}</span>
    {:else}
      <span class="stat failed">装配失败 · {data.assembly.issues.length} 个问题</span>
    {/if}
  </div>

  {#if data.assembly.ok}
    <RuntimeView document={data.assembly.document} {dataGateway} />
  {:else}
    <div class="assembly-issues" role="alert">
      <h1>临时页面态装配失败</h1>
      <p class="muted">装配出口未通过，以下是逐条问题；修复预置取数单元后刷新。</p>
      <ul>
        {#each data.assembly.issues as issue}
          <li>
            <p class="issue-head">
              <code class="issue-code">{issue.code}</code>
              {#if issue.dataSourceId}
                <code class="issue-source">{issue.dataSourceId}</code>
              {/if}
            </p>
            <p class="issue-message">{issue.message}</p>
            {#if issue.errors && issue.errors.length > 0}
              <ul class="typed-errors">
                {#each issue.errors as error}
                  <li>
                    <code class="issue-code">{error.type}</code>
                    <code class="issue-source">{error.path}</code>
                    <span>{error.message}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .ask-page {
    min-height: calc(100vh - 54px);
    background: #daeaff;
  }
  .statusbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 22px;
    background: #fff;
    border-bottom: 1px solid #e4e4e7;
  }
  .badge {
    padding: 3px 9px;
    color: #3730a3;
    background: #e0e7ff;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }
  .page-id {
    color: #3f3f46;
    font-size: 13px;
  }
  .stat {
    color: #71717a;
    font-size: 13px;
  }
  .stat.failed {
    color: #991b1b;
    font-weight: 600;
  }
  .assembly-issues {
    max-width: 60rem;
    padding: 24px 22px 54px;
    margin: 0 auto;
  }
  .assembly-issues h1 {
    margin: 0 0 6px;
    font-size: 20px;
  }
  .muted {
    margin: 0 0 16px;
    color: #71717a;
    font-size: 14px;
  }
  .assembly-issues > ul {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .assembly-issues > ul > li {
    padding: 12px 14px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    font-size: 14px;
  }
  .issue-head {
    display: flex;
    gap: 10px;
    margin: 0 0 4px;
  }
  .issue-code {
    color: #b91c1c;
    font-size: 12px;
    font-weight: 700;
  }
  .issue-source {
    color: #71717a;
    font-size: 12px;
  }
  .issue-message {
    margin: 0;
  }
  .typed-errors {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0;
    margin: 8px 0 0;
    list-style: none;
    font-size: 13px;
  }
  .typed-errors li {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
</style>
