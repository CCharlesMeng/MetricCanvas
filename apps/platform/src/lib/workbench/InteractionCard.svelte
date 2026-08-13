<script lang="ts">
  import type { AgentInteraction } from '../server/agent/types';

  /**
   * 待人工交互卡:运行停机等待确认(run_interaction_required),确认后由
   * 新运行继续。confirm_page_id 呈现结构化页面 id 确认;confirm_gap_entry
   * (#67)呈现待登记的指标需求条目——登记只在确认后发生,直接换个问题
   * 即放弃;其余交互类型按载荷回显并提供同一"确认并继续"动作。
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

  interface GapEntryPreview {
    businessDomain: string;
    sought: string;
    adHocFormula: string | null;
  }

  const gapEntries = $derived.by((): GapEntryPreview[] => {
    if (interaction.kind !== 'confirm_gap_entry') return [];
    const entries = interaction.payload.entries;
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) =>
      typeof entry === 'object' && entry !== null
        ? [
            {
              businessDomain: String((entry as GapEntryPreview).businessDomain ?? ''),
              sought: String((entry as GapEntryPreview).sought ?? ''),
              adHocFormula:
                typeof (entry as GapEntryPreview).adHocFormula === 'string'
                  ? (entry as GapEntryPreview).adHocFormula
                  : null
            }
          ]
        : []
    );
  });
</script>

<div class="interaction" class:gap={interaction.kind === 'confirm_gap_entry'}>
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
  {:else if interaction.kind === 'confirm_gap_entry'}
    <strong class="gap-title">⚑ 指标缺口</strong>
    <ul class="gap-list">
      {#each gapEntries as entry, entryIndex (entryIndex)}
        <li>
          <b>{entry.sought}</b>
          <small>
            {entry.businessDomain}{entry.adHocFormula
              ? ` · 临时口径 ${entry.adHocFormula}`
              : ''}
          </small>
        </li>
      {/each}
    </ul>
    <button type="button" class="gap-btn" disabled={confirming} onclick={onconfirm}>
      {confirming ? '登记中…' : '提交指标需求'}
    </button>
    <p class="meta">
      提交前先确认口径描述——需求只按你确认的内容登记,不由模型代填;
      同一缺口重复出现会累加次数。不登记则直接继续追问即可。
    </p>
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
  /* 缺口登记卡对齐原型 gapcard:琥珀警示系。 */
  .interaction.gap {
    background: #fffbeb;
    border-color: #fde68a;
  }
  strong {
    font-size: 12.5px;
  }
  .gap-title {
    color: #92400e;
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
  .gap-list {
    display: grid;
    gap: 4px;
    margin: 2px 0;
    padding: 8px 10px;
    background: #fff;
    border: 1px solid #fde68a;
    border-radius: 9px;
    list-style: none;
  }
  .gap-list li {
    display: grid;
    gap: 1px;
  }
  .gap-list b {
    font-size: 12px;
  }
  .gap-list small {
    color: #b45309;
    font-size: 11px;
    line-height: 1.5;
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
  /* 缺口登记按钮对齐原型 .btn.sm:白底小按钮。 */
  .gap-btn {
    padding: 5px 10px;
    color: #18181b;
    background: #fff;
    border: 1px solid #d4d4d8;
    border-radius: 9px;
    font-size: 11.5px;
    font-weight: 500;
    transition: border-color 0.15s ease;
  }
  .gap-btn:hover:not(:disabled) {
    border-color: #a1a1aa;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
