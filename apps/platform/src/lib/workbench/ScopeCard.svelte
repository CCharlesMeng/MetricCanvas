<script lang="ts">
  import type { ScopeCardView } from './run-state';

  /**
   * 口径卡(CONTEXT.md / ADR-0037):执行前完整回显生效范围——业务域、
   * 指标或临时口径、时间范围与粒度、筛选条件。临时口径与已定义指标
   * 视觉可区分;命中阻塞条件(候选歧义、自由生成表达式)时在卡上等待
   * 用户确认后才继续执行。
   */
  let {
    card,
    onconfirm
  }: {
    card: ScopeCardView;
    /** 等待确认且本卡可操作时由父组件传入;缺省只回显不提供动作。 */
    onconfirm?: (() => void) | undefined;
  } = $props();
</script>

<div class="scope" class:temporary={card.adHocDefinition !== null}>
  <div class="scope-head">
    <span>口径卡 · 生效范围</span>
    {#if card.adHocDefinition}
      <span class="warn-pill">临时口径</span>
    {/if}
  </div>
  <dl>
    <div>
      <dt>业务域</dt>
      <dd>{card.businessDomain}</dd>
    </div>
    <div>
      <dt>{card.metricName !== null ? '指标' : '临时口径'}</dt>
      <dd>
        {#if card.metricName !== null}
          {card.metricName}
        {:else if card.adHocDefinition}
          <code>{card.adHocDefinition.formula}</code>
          {#if card.adHocDefinition.description}
            <span class="muted">{card.adHocDefinition.description}</span>
          {/if}
        {:else}
          <span class="muted">未声明</span>
        {/if}
      </dd>
    </div>
    <div>
      <dt>时间</dt>
      <dd>{card.timeRange} · {card.granularity}粒度</dd>
    </div>
    <div>
      <dt>筛选</dt>
      <dd>
        {#if card.filters.length > 0}
          {#each card.filters as filter (filter.dimension)}
            <span class="filter">{filter.dimension} = {filter.values.join('、')}</span>
          {/each}
        {:else}
          <span class="muted">无</span>
        {/if}
      </dd>
    </div>
  </dl>
  {#if card.awaitingConfirmation && onconfirm}
    <div class="confirm-row">
      <button type="button" onclick={() => onconfirm?.()}>确认口径并执行</button>
      <p class="note">命中阻塞条件(候选歧义或自由生成表达式),已暂停执行;要修改口径,直接在下方追问。</p>
      {#if card.adHocDefinition}
        <p class="note">确认临时口径即登记一条指标需求条目(重复出现累加次数),供数据侧评估是否建设正式指标。</p>
      {/if}
    </div>
  {:else if card.blockedOnConfirmation}
    <p class="note">该口径卡命中阻塞条件,曾在执行前等待确认。</p>
  {/if}
</div>

<style>
  .scope {
    padding: 11px 12px;
    background: #fafafa;
    border: 1px solid #e4e4e7;
    border-radius: 11px;
  }
  .scope.temporary {
    background: #fffbeb;
    border-color: #fde68a;
  }
  .scope-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    color: #52525b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .warn-pill {
    padding: 2px 8px;
    color: #92400e;
    background: #fef3c7;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 500;
  }
  dl {
    display: grid;
    gap: 5px;
    margin: 0;
  }
  dl > div {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 8px;
  }
  dt {
    color: #a1a1aa;
    font-size: 11px;
  }
  dd {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  dd code {
    font-size: 11.5px;
    color: #92400e;
  }
  .filter {
    display: inline-block;
    padding: 1px 7px;
    margin: 0 4px 2px 0;
    background: #f4f4f5;
    border-radius: 6px;
    font-size: 11.5px;
  }
  .muted {
    color: #a1a1aa;
  }
  .confirm-row {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #fde68a;
  }
  .confirm-row button {
    padding: 6px 12px;
    color: #fff;
    background: #4f46e5;
    border: 1px solid #4f46e5;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
  }
  .confirm-row button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .note {
    margin: 6px 0 0;
    color: #71717a;
    font-size: 11px;
    line-height: 1.6;
  }
</style>
