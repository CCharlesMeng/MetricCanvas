<script lang="ts">
  import type { AgentInteraction } from '../server/agent/types';

  /**
   * 待人工交互卡:运行停机等待确认(run_interaction_required),确认后由
   * 新运行继续。confirm_page_id 呈现结构化页面 id 确认;其余交互类型按
   * 载荷回显并提供同一"确认并继续"动作——界面按事件契约实现,问数编排
   * (#66)新增交互类型时无需改造。
   */
  let {
    interaction,
    confirming = false,
    onconfirm
  }: {
    interaction: AgentInteraction;
    confirming?: boolean;
    onconfirm: () => void;
  } = $props();

  const payloadEntries = $derived(
    Object.entries(interaction.payload).filter(
      ([, value]) => typeof value !== 'object' || value === null
    )
  );
</script>

<div class="interaction">
  {#if interaction.kind === 'confirm_page_id'}
    <strong>确认页面 id</strong>
    <code class="page-id">{String(interaction.payload.pageId ?? '')}</code>
    {#if typeof interaction.payload.title === 'string'}
      <p class="meta">{interaction.payload.title}</p>
    {/if}
    <p class="meta">
      保存后页面 id 不可变更,稳定路径
      <code>{String(interaction.payload.stablePath ?? '')}</code>
    </p>
    <button type="button" disabled={confirming} onclick={onconfirm}>
      {confirming ? '继续运行中…' : '确认页面 id 并继续'}
    </button>
  {:else}
    <strong>等待人工确认 · {interaction.kind}</strong>
    {#if payloadEntries.length > 0}
      <dl>
        {#each payloadEntries as [key, value] (key)}
          <div><dt>{key}</dt><dd>{String(value)}</dd></div>
        {/each}
      </dl>
    {/if}
    <button type="button" disabled={confirming} onclick={onconfirm}>
      {confirming ? '继续运行中…' : '确认并继续'}
    </button>
  {/if}
</div>

<style>
  .interaction {
    display: grid;
    gap: 6px;
    padding: 12px;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 11px;
  }
  strong {
    font-size: 12.5px;
  }
  .page-id {
    font-size: 13px;
    color: #3730a3;
  }
  .meta {
    margin: 0;
    color: #52525b;
    font-size: 11.5px;
    line-height: 1.55;
  }
  dl {
    display: grid;
    gap: 3px;
    margin: 0;
  }
  dl > div {
    display: grid;
    grid-template-columns: minmax(60px, auto) minmax(0, 1fr);
    gap: 8px;
  }
  dt {
    color: #6366f1;
    font-size: 11px;
  }
  dd {
    margin: 0;
    font-size: 11.5px;
  }
  button {
    justify-self: start;
    padding: 6px 12px;
    color: #fff;
    background: #4f46e5;
    border: 1px solid #4f46e5;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
