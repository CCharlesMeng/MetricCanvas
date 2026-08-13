<script lang="ts">
  import type { ComponentCandidate } from '@metriccanvas/mcp';
  import type { ComponentLocator } from './document-edit';
  import type { PageComponentView, WorkbenchPageViewModel } from './transient-page';

  /**
   * 检查器(原型 ask-workbench.v2 右栏):选中画布组件后展示组件形态切换
   * (recommendComponents 唯一实现驱动:硬闸不满足置灰并附原因,推荐标星,
   * 切换即钉住)与数据绑定契约;未选中时是组件清单,点击与画布选中联动。
   */
  let {
    pageModel,
    selected,
    selectedView,
    candidates,
    fieldRows,
    busy = false,
    onSelectType,
    onSelectComponent
  }: {
    pageModel: WorkbenchPageViewModel | null;
    selected: ComponentLocator | null;
    selectedView: PageComponentView | null;
    candidates: ComponentCandidate[];
    fieldRows: Array<{ fieldId: string; label: string; role: string; type: string }>;
    busy?: boolean;
    onSelectType: (type: ComponentCandidate['type']) => void;
    onSelectComponent: (componentId: string) => void;
  } = $props();
</script>

<aside class="inspector">
  <header>
    <b>配置</b>
    <p>
      {selected
        ? '组件形态切换即时生效并钉住,追问不被改写'
        : '点击画布组件或下方清单进行配置'}
    </p>
  </header>

  {#if !pageModel}
    <div class="panel">
      <p class="hint">页面文档就绪后,这里可以配置每个组件。</p>
    </div>
  {:else if selected && selectedView}
    <div class="panel">
      <div class="selbar">
        <b>{selectedView.title ?? selectedView.componentLabel}</b>
        <small>{selectedView.componentType} · {selectedView.componentId}</small>
      </div>

      <section>
        <h5>组件形态</h5>
        <div class="types">
          {#each candidates as candidate (candidate.type)}
            <button
              type="button"
              class:on={candidate.type === selectedView.componentType}
              class:rec={candidate.recommended &&
                candidate.type !== selectedView.componentType}
              disabled={busy || !candidate.ok}
              title={candidate.ok
                ? candidate.recommended
                  ? '按当前数据形状推荐'
                  : undefined
                : candidate.reasons.join(';')}
              onclick={() => onSelectType(candidate.type)}
            >
              {candidate.label}{#if candidate.recommended && candidate.ok}<span class="star">★</span>{/if}
            </button>
          {/each}
        </div>
        <p class="hint">置灰的形态不满足数据形状硬闸,悬停可见原因。</p>
      </section>

      {#if selectedView.dataSourceId}
        <section>
          <h5>数据绑定</h5>
          <dl class="kv">
            <div><dt>数据源</dt><dd><code>{selectedView.dataSourceId}</code></dd></div>
          </dl>
          {#if fieldRows.length > 0}
            <table class="contract">
              <thead>
                <tr><th>字段</th><th>角色</th><th>类型</th></tr>
              </thead>
              <tbody>
                {#each fieldRows as row (row.fieldId)}
                  <tr>
                    <td>{row.label}</td>
                    <td>{row.role === 'dimension' ? '维度' : row.role === 'measure' ? '度量' : row.role}</td>
                    <td>{row.type}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </section>
      {/if}

      <p class="hint">画布上选中组件可拖拽重排、改画布内标题与宽度(−/＋)。</p>
    </div>
  {:else}
    <div class="panel">
      <section>
        <h5>页面组件({pageModel.components.length})</h5>
        <ul class="mlist">
          {#each pageModel.components as component (component.componentId)}
            <li>
              <button type="button" onclick={() => onSelectComponent(component.componentId)}>
                <b>{component.title ?? component.componentLabel}</b>
                <small>
                  {component.componentLabel}{component.dataSourceId
                    ? ` · ${component.dataSourceId}`
                    : ''}
                </small>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    </div>
  {/if}
</aside>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--surface);
    border-left: 1px solid var(--line);
  }
  .inspector > header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
  }
  .inspector > header b {
    font-size: 13px;
  }
  .inspector > header p {
    margin: 3px 0 0;
    color: var(--faint);
    font-size: 11px;
    line-height: 1.5;
  }
  .panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    overflow-y: auto;
  }
  .selbar {
    display: grid;
    gap: 2px;
    padding: 9px 12px;
    background: #fafaff;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .selbar b {
    font-size: 12.5px;
  }
  .selbar small {
    overflow: hidden;
    color: var(--faint);
    font-size: 10.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  section {
    display: grid;
    gap: 8px;
  }
  h5 {
    margin: 0;
    color: #52525b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .types {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .types button {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 999px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      color 0.15s ease;
  }
  .types button:hover:not(:disabled):not(.on) {
    border-color: var(--faint);
  }
  .types button.on {
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
  }
  .types button.rec:not(.on) {
    color: #4338ca;
    border-color: #a5b4fc;
  }
  .types button:disabled {
    color: var(--faint);
    background: #fafafa;
    border-style: dashed;
    cursor: not-allowed;
  }
  .types .star {
    font-size: 9px;
  }
  .kv {
    display: grid;
    gap: 6px;
    margin: 0;
  }
  .kv > div {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 8px;
  }
  .kv dt {
    color: var(--faint);
    font-size: 11px;
  }
  .kv dd {
    margin: 0;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .kv code {
    padding: 1px 6px;
    background: var(--line-soft);
    border-radius: 5px;
    font-size: 11px;
  }
  .contract {
    width: 100%;
    border-collapse: collapse;
  }
  .contract th,
  .contract td {
    padding: 5px 6px;
    border-bottom: 1px solid var(--line-soft);
    font-size: 11px;
    text-align: left;
  }
  .contract th {
    color: var(--muted);
    font-weight: 600;
  }
  .contract tbody tr:last-child td {
    border-bottom: 0;
  }
  .mlist {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .mlist button {
    display: grid;
    width: 100%;
    gap: 2px;
    padding: 10px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 10px;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .mlist button:hover {
    border-color: rgb(79 70 229 / 45%);
    box-shadow: 0 2px 8px rgb(24 24 27 / 6%);
  }
  .mlist b {
    font-size: 12.5px;
  }
  .mlist small {
    color: var(--muted);
    font-size: 11px;
  }
  .hint {
    margin: 0;
    color: var(--faint);
    font-size: 11px;
    line-height: 1.6;
  }
</style>
