<script lang="ts">
  import type { MetricCandidate } from '../server/session/step-event';

  /**
   * 指标候选卡(原型 ask-workbench.v2 的 .candidates):对话轨一等公民。
   *
   * 两种形态,由 selectable 判别,不可混用:
   * - 消歧阻塞(编排未选中且候选多于一个):radio 单选,选择随取数核对确认
   *   以 scope_card 确认(selectedMetric)传回编排。ADR-0037 的消歧本就是
   *   近义指标里三选一,radio 的互斥语义在这里成立。
   * - 非阻塞:只读回显本轮选用的指标,checkbox 形态。一句问题点到多个指标
   *   时它们各成一个单元(ADR-0055),选用的可以是多个,radio 的互斥语义会
   *   把已查过的指标显示成未选中。
   *
   * 候选与口径差异说明来自 candidates_retrieved 步骤事件。
   */
  let {
    candidates,
    selectedMetrics,
    selectable = false,
    chosen = null,
    onselect
  }: {
    candidates: readonly MetricCandidate[];
    /** 编排本轮选用的指标名;歧义未决或检索未命中时为空。 */
    selectedMetrics: readonly string[];
    /** 消歧阻塞且本轮可操作:radio 可选。 */
    selectable?: boolean;
    /** 用户当前选择(仅 selectable 时有意义)。 */
    chosen?: MetricCandidate | null;
    onselect?: (candidate: MetricCandidate) => void;
  } = $props();

  const groupName = `candidates-${Math.random().toString(36).slice(2, 8)}`;

  function isChecked(candidate: MetricCandidate): boolean {
    if (selectable) {
      return (
        chosen?.metricName === candidate.metricName &&
        chosen?.businessDomain === candidate.businessDomain
      );
    }
    return selectedMetrics.includes(candidate.metricName);
  }
</script>

<div class="candidates">
  <p>
    {#if selectable}
      命中 {candidates.length} 个近义指标,口径不同,请选择:
    {:else if selectedMetrics.length > 0}
      命中 {candidates.length} 个候选,勾选为本轮选用:
    {:else}
      命中 {candidates.length} 个近义指标,口径不同:
    {/if}
  </p>
  {#each candidates as candidate (candidate.businessDomain + candidate.metricName)}
    <label class:static={!selectable}>
      {#if selectable}
        <input
          type="radio"
          name={groupName}
          checked={isChecked(candidate)}
          onchange={() => onselect?.(candidate)}
        />
      {:else}
        <input type="checkbox" checked={isChecked(candidate)} disabled />
      {/if}
      <span>
        <b>{candidate.metricName}</b>
        <small>
          {candidate.businessDomain}{candidate.definitionDifference
            ? ` · ${candidate.definitionDifference}`
            : ''}
        </small>
      </span>
    </label>
  {/each}
</div>

<style>
  .candidates {
    padding: 11px 12px;
    background: #fafafa;
    border: 1px solid #e4e4e7;
    border-radius: 11px;
  }
  .candidates > p {
    margin: 0 0 8px;
    color: #71717a;
    font-size: 12px;
  }
  label {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 5px 0;
    cursor: pointer;
  }
  label.static {
    cursor: default;
  }
  input {
    margin: 2px 0 0;
    accent-color: #4f46e5;
  }
  /* 只读回显的勾是状态标记而非可操作控件:不因 disabled 而灰掉。 */
  input[type='checkbox']:disabled {
    opacity: 1;
  }
  input:disabled {
    cursor: default;
  }
  label span {
    display: grid;
    gap: 2px;
  }
  b {
    font-size: 12.5px;
  }
  input:checked + span b {
    color: #4f46e5;
  }
  small {
    color: #71717a;
    font-size: 11.5px;
    line-height: 1.5;
  }
</style>
