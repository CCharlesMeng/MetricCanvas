<script lang="ts">
  import type { MetricCandidate } from '../server/session/step-event';

  /**
   * 指标候选卡(原型 ask-workbench.v2 的 .candidates):对话轨一等公民。
   * 消歧阻塞时(编排未选中且候选多于一个)radio 可选,选择随口径卡确认
   * 以 scope_card 确认(selectedMetric)传回编排;非阻塞时只读回显编排
   * 的选中项。候选与口径差异说明来自 candidates_retrieved 步骤事件。
   */
  let {
    candidates,
    selectedMetric,
    selectable = false,
    chosen = null,
    onselect
  }: {
    candidates: readonly MetricCandidate[];
    /** 编排确定性选中的指标;歧义时为 null。 */
    selectedMetric: string | null;
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
    return candidate.metricName === selectedMetric;
  }
</script>

<div class="candidates">
  <p>
    {#if selectable}
      命中 {candidates.length} 个近义指标,口径不同,请选择:
    {:else if selectedMetric !== null}
      命中 {candidates.length} 个候选,已选「{selectedMetric}」:
    {:else}
      命中 {candidates.length} 个近义指标,口径不同:
    {/if}
  </p>
  {#each candidates as candidate (candidate.businessDomain + candidate.metricName)}
    <label class:static={!selectable}>
      <input
        type="radio"
        name={groupName}
        checked={isChecked(candidate)}
        disabled={!selectable}
        onchange={() => onselect?.(candidate)}
      />
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
  input[type='radio'] {
    margin: 2px 0 0;
    accent-color: #4f46e5;
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
