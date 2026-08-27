<script lang="ts">
  import type { ScopeCardView } from './run-state';

  /**
   * 取数核对(CONTEXT.md / ADR-0037):执行前完整回显生效范围——业务域、
   * 指标或临时指标、分组维度、时间范围与粒度、筛选条件。临时指标与已定义
   * 指标视觉可区分;命中阻塞条件(候选歧义、自由生成表达式)时在卡上等待
   * 用户确认后才继续执行。
   *
   * 分组维度必须在卡上:一轮多个单元时,同一指标按不同维度切分是几张卡
   * 之间唯一的差别(ADR-0055)。
   */
  let {
    card,
    onconfirm,
    confirmDisabled = false
  }: {
    card: ScopeCardView;
    /** 等待确认且本卡可操作时由父组件传入;缺省只回显不提供动作。 */
    onconfirm?: (() => void) | undefined;
    /** 候选歧义尚未选择口径:确认按钮禁用并提示先选候选。 */
    confirmDisabled?: boolean;
  } = $props();
</script>

<div class="scope" class:temporary={card.adHocDefinition !== null}>
  <div class="scope-head">
    <span>取数核对 · 生效范围</span>
    {#if card.adHocDefinition}
      <span class="warn-pill">临时指标</span>
    {/if}
  </div>
  <dl>
    <div>
      <dt>业务域</dt>
      <dd>{card.businessDomain}</dd>
    </div>
    <div>
      <dt>{card.metricName !== null ? '指标' : '临时指标'}</dt>
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
      <dt>切分</dt>
      <dd>
        {#if card.groupBy.length > 0}
          {card.groupBy.join('、')}
        {:else}
          <span class="muted">不切分,只出总量</span>
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
      <button type="button" disabled={confirmDisabled} onclick={() => onconfirm?.()}>
        确认口径并执行
      </button>
      {#if confirmDisabled}
        <p class="note">请先在上方候选卡中选择一个口径,再确认执行。</p>
      {/if}
      <p class="note">命中阻塞条件(候选歧义或自由生成表达式),已暂停执行;要修改口径,直接在下方追问。</p>
      {#if card.adHocDefinition}
        <p class="note">确认临时指标即登记一条指标需求条目(重复出现累加次数),供数据侧评估是否建设正式指标。</p>
      {/if}
    </div>
  {:else if card.blockedOnConfirmation}
    <p class="note">该取数核对命中阻塞条件,曾在执行前等待确认。</p>
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
