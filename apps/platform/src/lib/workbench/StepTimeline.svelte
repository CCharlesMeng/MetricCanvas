<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { RunStep } from './run-state';

  /**
   * 步骤时间线:按到达顺序展开一次运行的编排步骤(ADR-0037:路由 →
   * 候选 → 口径卡 → 真实执行 → 结果就绪 → 文档就绪)与工具调用进度。
   * 工具调用呈现名称与进行中 / 成功 / 失败状态,失败附稳定错误码。
   */
  let { steps }: { steps: RunStep[] } = $props();

  const INTENT_LABELS: Record<string, string> = {
    comparison: '对比',
    trend: '趋势',
    composition: '构成',
    ranking: '排名',
    detail: '明细',
    single_value: '单值'
  };

  const STAGE_LABELS: Record<string, string> = {
    discovery: '发现',
    generation: '生成',
    execution: '执行',
    presentation: '呈现'
  };

  function icon(step: RunStep): string {
    switch (step.kind) {
      case 'domain_routed':
        return '◎';
      case 'candidates_retrieved':
        return '⋔';
      case 'scope_card':
        return '⌘';
      case 'execution_started':
        return '↻';
      case 'rows_ready':
        return '▤';
      case 'document_ready':
        return '◱';
      case 'tool_call':
        return step.status === 'running' ? '…' : step.status === 'failed' ? '✕' : '⚙';
      case 'metric_gap':
        return '◇';
      case 'step_failed':
        return '✕';
      case 'interaction_required':
        return '⏸';
    }
  }
</script>

<ol class="steps">
  {#each steps as step, index (index)}
    <li
      in:fly={{ y: 6, duration: 220 }}
      class:failed={step.kind === 'step_failed' || (step.kind === 'tool_call' && step.status === 'failed')}
    >
      <span class="marker">
        {#if step.kind === 'tool_call' && step.status === 'running'}
          <span class="spinner" aria-hidden="true"></span>
        {:else if step.kind === 'tool_call' && step.status === 'succeeded'}
          <span class="ico ok">✓</span>
        {:else if step.kind === 'step_failed' || (step.kind === 'tool_call' && step.status === 'failed')}
          <span class="ico bad">✕</span>
        {:else}
          <span class="ico">{icon(step)}</span>
        {/if}
      </span>
      {#if step.kind === 'domain_routed'}
        <span class="t">
          <b>业务域路由</b>
          <small>
            {step.routedDomains.join('、')}{step.overriddenByUser ? ' · 用户已改写' : ''}
          </small>
        </span>
      {:else if step.kind === 'candidates_retrieved'}
        <span class="t">
          <b>指标候选</b>
          <small>
            {#if step.candidates.length > 0}
              命中 {step.candidates.length} 个候选
              {#if step.selectedMetric}
                · 选中「{step.selectedMetric}」
              {/if}
            {:else}
              无候选命中
            {/if}
            {#if step.adHocDefinition}
              · 临时口径 <code>{step.adHocDefinition.formula}</code>
            {/if}
          </small>
          {#if step.candidates.length > 0}
            <ul class="candidates">
              {#each step.candidates as candidate (candidate.metricName)}
                <li class:chosen={candidate.metricName === step.selectedMetric}>
                  <b>{candidate.metricName}</b>
                  <small>
                    {candidate.businessDomain}{candidate.definitionDifference
                      ? ` · ${candidate.definitionDifference}`
                      : ''}
                  </small>
                </li>
              {/each}
            </ul>
          {/if}
        </span>
      {:else if step.kind === 'scope_card'}
        <span class="t">
          <b>口径卡</b>
          <small>
            {step.card.blockedOnConfirmation
              ? '命中阻塞条件,执行前等待确认'
              : '完整生效范围已回显,直接执行'}
          </small>
        </span>
      {:else if step.kind === 'execution_started'}
        <span class="t"><b>真实执行</b><small>生效查询已提交服务端取数入口</small></span>
      {:else if step.kind === 'rows_ready'}
        <span class="t">
          <b>结果就绪</b>
          <small>
            {step.summary.rowCount} 行{step.summary.totalCount !== null
              ? ` · 总数 ${step.summary.totalCount}`
              : ''} · 输出字段 {step.summary.outputFields.join('、')}
          </small>
        </span>
      {:else if step.kind === 'document_ready'}
        <span class="t">
          <b>页面文档就绪</b>
          <small>
            意图={INTENT_LABELS[step.intent] ?? step.intent} ·
            {step.components
              .map(
                (choice) =>
                  `${choice.componentType}${choice.pinnedByUser ? '(已钉住)' : ''}`
              )
              .join(' + ')}
            · <code>{step.transientPageId}</code>
          </small>
        </span>
      {:else if step.kind === 'tool_call'}
        <span class="t">
          <b>工具调用 {step.toolName}</b>
          <small>
            {step.status === 'running'
              ? '进行中'
              : step.status === 'succeeded'
                ? '成功'
                : `失败${step.errorCode ? ` · ${step.errorCode}` : ''}`}
          </small>
        </span>
      {:else if step.kind === 'metric_gap'}
        <span class="t">
          <b>指标需求条目已登记</b>
          <small>
            {step.gap.businessDomain} ·
            {step.gap.adHocDefinition
              ? `临时口径 ${step.gap.adHocDefinition.formula}`
              : step.gap.searchTerms.join('、') || step.gap.question}
            · 同一缺口重复出现将累加次数
          </small>
        </span>
      {:else if step.kind === 'step_failed'}
        <span class="t">
          <b>步骤失败 · {STAGE_LABELS[step.stage] ?? step.stage}</b>
          <small><code>{step.code}</code> {step.message}</small>
        </span>
      {:else if step.kind === 'interaction_required'}
        <span class="t">
          <b>等待人工确认</b>
          <small>{step.interactionKind}</small>
        </span>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .steps {
    display: grid;
    gap: 0;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .steps li {
    position: relative;
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 8px;
    align-items: baseline;
    padding: 4px 0;
  }
  /* 时间线连接线:串起各步骤的 marker,末项不再向下延伸。 */
  .steps li:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 18px;
    bottom: -4px;
    left: 7.5px;
    width: 1px;
    background: #e4e4e7;
  }
  .steps li.failed .t b,
  .steps li.failed .ico {
    color: #b91c1c;
  }
  .marker {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
  }
  .ico {
    color: #a1a1aa;
    font-size: 11px;
  }
  .ico.ok {
    color: #16a34a;
    font-weight: 700;
  }
  .ico.bad {
    color: #b91c1c;
    font-weight: 700;
  }
  .spinner {
    width: 10px;
    height: 10px;
    border: 1.5px solid #c7d2fe;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .t {
    display: grid;
    gap: 1px;
  }
  .t b {
    font-size: 12px;
  }
  .t small {
    color: #71717a;
    font-size: 11px;
    line-height: 1.5;
  }
  .t code {
    font-size: 10.5px;
    color: #52525b;
  }
  .candidates {
    display: grid;
    gap: 3px;
    padding: 6px 8px;
    margin: 5px 0 2px;
    background: #fafafa;
    border: 1px solid #f4f4f5;
    border-radius: 8px;
    list-style: none;
  }
  .candidates li {
    display: grid;
    gap: 1px;
    padding: 2px 0;
  }
  .candidates li.chosen b {
    color: #4f46e5;
  }
  .candidates b {
    font-size: 11.5px;
  }
  .candidates small {
    color: #71717a;
    font-size: 10.5px;
  }
</style>
