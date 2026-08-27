<script lang="ts">
  import {
    DATA_APP_ROLLING_TIME_LIMITATION,
    pageIdConfirmationPayload
  } from '@metriccanvas/mcp/authoring/promote';
  import type { FormulaTrace } from '@metriccanvas/mcp';
  import {
    adHocDefinitionsOf,
    buildPromotion,
    formalPageIdError,
    promotionSaveBody,
    type PromoteDirection,
    type PromotedOutcome
  } from './promote-flow';

  /**
   * 沉淀面板(#68,ADR-0030):把临时页面态显式转为长期资产。
   *
   * 两个方向的改写都是 @metriccanvas/mcp/authoring/promote 的纯函数,
   * 面板对当前输入实时试算(纯函数、无 IO),问题清单与确认事实都来自
   * 试算结果;页面 id 的显式确认与 confirm_page_id 机制同源(载荷同构,
   * 确认翻译为保存命令的 pageIdConfirmed)。保存走既有修订通道。
   */

  let {
    document,
    formulaTraces,
    onclose,
    onpromoted
  }: {
    /** 当前临时页面态(已通过页面校验的完整文档)。 */
    document: Record<string, unknown>;
    /** 临时指标留痕(ask 会话状态,#66):沉淀警告的问题原文来源。 */
    formulaTraces: FormulaTrace[];
    onclose: () => void;
    onpromoted: (outcome: PromotedOutcome) => void;
  } = $props();

  interface SaveRevisionResponse {
    ok?: boolean;
    revision?: {
      revisionId: string;
      revisionNumber: number;
      dataContextVersion: string | null;
    };
    error?: { code?: string; message?: string };
  }

  let direction = $state<PromoteDirection>('dataApp');
  let pageIdText = $state('');
  let adHocAccepted = $state(false);
  let saving = $state(false);
  let saveError = $state('');

  const pageId = $derived(pageIdText.trim());
  const inputError = $derived(pageId === '' ? null : formalPageIdError(pageId));
  const adHocDefinitions = $derived(adHocDefinitionsOf(document, formulaTraces));
  const needsAcceptance = $derived(
    direction === 'dataApp' && adHocDefinitions.length > 0
  );
  /** 对当前输入实时试算纯函数改写;产物即最终保存的文档。 */
  const preview = $derived(
    pageId === '' || inputError !== null
      ? null
      : buildPromotion({
          document,
          direction,
          pageId,
          acceptAdHocDefinitions: adHocAccepted,
          formulaTraces
        })
  );
  /** 临时指标闸的问题由勾选块呈现,不重复列入问题清单。 */
  const issues = $derived(
    preview !== null && !preview.ok
      ? preview.issues.filter((issue) => issue.code !== 'AD_HOC_DEFINITIONS_NOT_ACCEPTED')
      : []
  );
  const ready = $derived(preview?.ok === true);
  const confirmation = $derived(
    preview?.ok === true ? pageIdConfirmationPayload(preview.document, pageId) : null
  );

  async function promote() {
    if (preview?.ok !== true || saving) return;
    saving = true;
    saveError = '';
    try {
      const response = await fetch(
        `/api/pages/${encodeURIComponent(pageId)}/revisions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(promotionSaveBody(preview.document, crypto.randomUUID()))
        }
      );
      const payload = (await response.json()) as SaveRevisionResponse;
      if (!response.ok || !payload.ok || !payload.revision) {
        throw new Error(payload.error?.message ?? `沉淀保存失败:${response.status}`);
      }
      onpromoted({
        direction,
        pageId,
        document: preview.document,
        revisionId: payload.revision.revisionId,
        revisionNumber: payload.revision.revisionNumber,
        dataContextVersion: payload.revision.dataContextVersion
      });
    } catch (cause) {
      saveError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      saving = false;
    }
  }
</script>

<div class="overlay" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label="沉淀为长期资产">
    <header>
      <div>
        <p class="eyebrow">沉淀</p>
        <h2>把临时页面态转为长期资产</h2>
      </div>
      <button type="button" class="close" aria-label="关闭" onclick={onclose}>×</button>
    </header>

    <fieldset class="directions">
      <legend>沉淀方向(时间语义相反)</legend>
      <label class="direction" class:active={direction === 'dataApp'}>
        <input type="radio" value="dataApp" bind:group={direction} />
        <span class="direction-name">Data App</span>
        <span class="direction-desc">
          保存为页面修订,进入修订历史与发布治理;长期运行,时间应随周期滚动。
        </span>
      </label>
      <label class="direction" class:active={direction === 'report'}>
        <input type="radio" value="report" bind:group={direction} />
        <span class="direction-name">报告</span>
        <span class="direction-desc">
          一次性分析结论:保留查询定义与采集时点的内嵌初始行、去掉筛选绑定,
          默认状态不重新查询,内容冻结在采集时点,同时保住口径溯源。
        </span>
      </label>
    </fieldset>

    {#if direction === 'dataApp'}
      <p class="limitation" role="note">
        <strong>已知限制</strong>
        {DATA_APP_ROLLING_TIME_LIMITATION}
      </p>
      {#if needsAcceptance}
        <div class="adhoc" role="alert">
          <p class="adhoc-title">本页面含 {adHocDefinitions.length} 个临时指标,无人负责其长期正确性:</p>
          <ul>
            {#each adHocDefinitions as usage (usage.dataSourceId + usage.expression)}
              <li>
                <code>{usage.expression}</code>
                {#if usage.alias}<span class="muted">输出字段 {usage.alias}</span>{/if}
                {#if usage.question}<span class="muted">来自问题「{usage.question}」</span>{/if}
              </li>
            {/each}
          </ul>
          <label class="accept">
            <input type="checkbox" bind:checked={adHocAccepted} />
            我已知晓并接受:沉淀为 Data App 后这些临时指标无人负责
          </label>
        </div>
      {/if}
    {/if}

    <label class="page-id-row">
      <span>正式页面 id(保存后不可变更)</span>
      <input
        type="text"
        bind:value={pageIdText}
        placeholder="例如 region-gmv-overview"
        spellcheck="false"
      />
    </label>
    {#if inputError}
      <p class="issue">{inputError}</p>
    {/if}
    {#each issues as issue (issue.code + (issue.dataSourceId ?? ''))}
      <p class="issue">
        {issue.message}
        {#if issue.errors}
          {#each issue.errors.slice(0, 3) as error, errorIndex (errorIndex)}
            <span class="issue-detail">{error.path}:{error.message}</span>
          {/each}
        {/if}
      </p>
    {/each}

    {#if confirmation && preview?.ok}
      <div class="confirm">
        <p class="confirm-title">确认页面 id</p>
        <dl>
          <div><dt>页面 id</dt><dd><code>{confirmation.pageId}</code></dd></div>
          <div><dt>稳定路径</dt><dd><code>{confirmation.stablePath}</code></dd></div>
          {#if preview.frozenAt.length > 0}
            <div>
              <dt>采集时点</dt>
              <dd>
                {#each preview.frozenAt as frozen (frozen.dataSourceId)}
                  <span class="frozen">{frozen.dataSourceId} · {frozen.capturedAt}</span>
                {/each}
              </dd>
            </div>
          {/if}
        </dl>
        <p class="note">页面 id 保存后不可变更;首个修订保存到该 id 名下。</p>
      </div>
    {/if}

    {#if saveError}
      <p class="issue" role="alert">{saveError}</p>
    {/if}

    <footer>
      <button type="button" class="ghost" onclick={onclose}>取消</button>
      <button type="button" class="primary" disabled={!ready || saving} onclick={promote}>
        {saving
          ? '保存中…'
          : direction === 'dataApp'
            ? '确认沉淀为 Data App'
            : '确认沉淀为报告'}
      </button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgb(24 24 27 / 40%);
  }
  .panel {
    display: grid;
    gap: 14px;
    width: min(560px, 100%);
    max-height: calc(100vh - 48px);
    padding: 18px 20px;
    overflow-y: auto;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 18px 50px rgb(0 0 0 / 22%);
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .eyebrow {
    margin: 0;
    color: #4f46e5;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h2 {
    margin: 4px 0 0;
    font-size: 15px;
  }
  .close {
    padding: 0 6px;
    color: #a1a1aa;
    background: none;
    border: 0;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }
  .close:hover {
    color: #52525b;
  }
  .directions {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 6px;
    padding: 0;
    color: #52525b;
    font-size: 11.5px;
    font-weight: 700;
  }
  .direction {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 2px 8px;
    padding: 10px 12px;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }
  .direction.active {
    background: #eef2ff;
    border-color: #c7d2fe;
  }
  .direction input {
    grid-row: span 2;
    align-self: start;
    margin-top: 2px;
    accent-color: #4f46e5;
  }
  .direction-name {
    font-size: 13px;
    font-weight: 650;
  }
  .direction-desc {
    grid-column: 2;
    color: #71717a;
    font-size: 11.5px;
    line-height: 1.6;
  }
  .limitation {
    margin: 0;
    padding: 9px 12px;
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 10px;
    font-size: 11.5px;
    line-height: 1.6;
  }
  .limitation strong {
    display: block;
    margin-bottom: 2px;
    font-size: 11px;
    letter-spacing: 0.05em;
  }
  .adhoc {
    padding: 10px 12px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 10px;
  }
  .adhoc-title {
    margin: 0 0 6px;
    color: #92400e;
    font-size: 12px;
    font-weight: 650;
  }
  .adhoc ul {
    display: grid;
    gap: 4px;
    margin: 0 0 8px;
    padding-left: 18px;
    font-size: 11.5px;
  }
  .adhoc code {
    color: #92400e;
  }
  .muted {
    margin-left: 6px;
    color: #a16207;
    font-size: 11px;
  }
  .accept {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    color: #713f12;
    font-size: 11.5px;
    line-height: 1.5;
    cursor: pointer;
  }
  .accept input {
    margin-top: 1px;
    accent-color: #b45309;
  }
  .page-id-row {
    display: grid;
    gap: 5px;
  }
  .page-id-row span {
    color: #52525b;
    font-size: 11.5px;
    font-weight: 650;
  }
  .page-id-row input {
    padding: 8px 10px;
    border: 1px solid #d4d4d8;
    border-radius: 9px;
    font: inherit;
    font-size: 13px;
  }
  .page-id-row input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgb(99 102 241 / 12%);
  }
  .issue {
    margin: 0;
    padding: 8px 11px;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 9px;
    font-size: 11.5px;
    line-height: 1.6;
  }
  .issue-detail {
    display: block;
    color: #991b1b;
    font-size: 11px;
  }
  .confirm {
    padding: 10px 12px;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 10px;
  }
  .confirm-title {
    margin: 0 0 6px;
    color: #3730a3;
    font-size: 11.5px;
    font-weight: 700;
  }
  .confirm dl {
    display: grid;
    gap: 4px;
    margin: 0;
  }
  .confirm dl > div {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 8px;
  }
  .confirm dt {
    color: #6366f1;
    font-size: 11px;
  }
  .confirm dd {
    margin: 0;
    font-size: 12px;
  }
  .confirm code {
    color: #3730a3;
  }
  .frozen {
    display: inline-block;
    margin: 0 6px 2px 0;
    padding: 1px 7px;
    background: #e0e7ff;
    border-radius: 6px;
    font-size: 11px;
  }
  .note {
    margin: 6px 0 0;
    color: #71717a;
    font-size: 11px;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .ghost,
  .primary {
    padding: 7px 14px;
    border-radius: 9px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .ghost {
    color: #3f3f46;
    background: #fff;
    border: 1px solid #d4d4d8;
  }
  .ghost:hover {
    border-color: #a1a1aa;
  }
  .primary {
    color: #fff;
    background: #4f46e5;
    border: 1px solid #4f46e5;
  }
  .primary:hover:not(:disabled) {
    background: #4338ca;
    border-color: #4338ca;
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
