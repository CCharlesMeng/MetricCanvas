<script lang="ts">
  import ToolAction from '../ToolAction.svelte';
  import {Select,Input} from '@metriccanvas/ui';
  import ReportDateProperties from './ReportDateProperties.svelte';
  import type { CanvasAuthoringDraft } from './document-edit';
  import type { ReportDateEdit } from './report-date-edit';
  import ComponentProperties from './ComponentProperties.svelte';
  import type { PropertyControl, PropertyEdit } from './property-edit';
  import type { ComponentCandidate } from './component-selection';
  import type { ComponentLocator } from './document-edit';
  import type { PageComponentView, WorkbenchPageViewModel } from './transient-page';

  /**
   * 检查器(原型 ask-workbench.v2 右栏):选中画布组件后展示组件形态切换
   * (recommendComponents 唯一实现驱动:硬闸不满足置灰并附原因,推荐标星,
   * 浏览器局部构造)与数据绑定契约;未选中时是组件清单,点击与画布选中联动。
   */
  let {
    pageModel,
    selected,
    selectedView,
    selectedSpan = null,
    selectedColumnCount = 12,
    candidates,
    fieldRows,
    busy = false,
    onSelectType,
    onSelectComponent,
    onEdit,
    properties = [],
    onPropertyEdit, dateDraft, onDateEdit
  }: {
    dateDraft?: CanvasAuthoringDraft | null;
    onDateEdit?: (edit:ReportDateEdit)=>void;
    pageModel: WorkbenchPageViewModel | null;
    selected: ComponentLocator | null;
    selectedView: PageComponentView | null;
    /** 选中组件的当前宽度；未选中为 null。 */
    selectedSpan?: number | null;
    /** 所属分区当前列轨数；缺省分区为 12。 */
    selectedColumnCount?: number;
    candidates: ComponentCandidate[];
    fieldRows: Array<{ fieldId: string; label: string; role: string; type: string }>;
    busy?: boolean;
    onSelectType: (type: ComponentCandidate['type']) => void;
    onSelectComponent: (componentId: string) => void;
    onEdit: (edit: { title?: string; span?: number }) => void;
    properties?: PropertyControl[];
    onPropertyEdit?: (edit: PropertyEdit) => void;
  } = $props();
</script>

<aside class="inspector">
  <header>
    <b>配置</b>
    <p>
      {selected
        ? '组件形态切换即时生效；保存后成为页面修订'
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
        <Select label="组件形态" value={selectedView.componentType} disabled={busy} options={candidates.map(candidate=>({value:candidate.type,label:candidate.label+(candidate.recommended&&candidate.ok?' · 推荐':candidate.ok?'':' · 不适用'),disabled:!candidate.ok}))} onchange={value=>{const candidate=candidates.find(item=>item.type===value);if(candidate?.ok)onSelectType(candidate.type);}}/>
        <p class="hint">可用形态取决于当前组件的数据。</p>
      </section>

      <section>
        <h5>布局</h5>
        <label class="field">
          <span>组件标题</span>
          <Input label="组件标题" value={selectedView.title??''} placeholder="留空使用默认标题" disabled={busy} oncommit={value=>onEdit({title:value})}/>
        </label>
        {#if selectedSpan !== null}
          <div class="span-row">
            <span>宽度</span>
            <ToolAction icon="minus" iconOnly ariaLabel="缩小组件" disabled={busy||selectedSpan<=1} onclick={()=>onEdit({span:selectedSpan!-1})}/>
            <b>{selectedSpan}/{selectedColumnCount}</b>
            <ToolAction icon="plus" iconOnly ariaLabel="加宽组件" disabled={busy||selectedSpan>=selectedColumnCount} onclick={()=>onEdit({span:selectedSpan!+1})}/>
          </div>
        {/if}
      </section>

      {#if onPropertyEdit}<ComponentProperties controls={properties} {busy} onEdit={onPropertyEdit} />{/if}
      {#if selectedView.componentType==='reportHeader' && selected && dateDraft && onDateEdit}<ReportDateProperties draft={dateDraft} locator={selected} {busy} onEdit={onDateEdit}/>{/if}

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

      <p class="hint">画布上可直接拖拽组件重排;标题与宽度在此配置。</p>
    </div>
  {:else}
    <div class="panel">
      <section>
        <h5>页面组件({pageModel.components.length})</h5>
        <ul class="mlist">
          {#each pageModel.components as component (component.componentId)}
            <li>
              <button type="button" class="component-entry" disabled={busy} onclick={() => onSelectComponent(component.componentId)}>
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
    padding: 16px;
    border-bottom: 1px solid var(--line);
  }
  .inspector > header b {
    font-size: 14px;
  }
  .inspector > header p {
    margin: 3px 0 0;
    color: var(--faint);
    font-size: 12px;
    line-height: 1.5;
  }
  .panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
  }
  .selbar {
    display: grid;
    gap: 2px;
    padding: 9px 12px;
    background: #f5f5f5;
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .selbar b {
    font-size: 14px;
  }
  .selbar small {
    overflow: hidden;
    color: var(--faint);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  section {
    display: grid;
    gap: 8px;
  }
  h5 {
    margin: 0;
    color: #595959;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: normal;
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
    font-size: 12px;
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
    font-size: 12px;
  }
  .contract {
    width: 100%;
    border-collapse: collapse;
  }
  .contract th,
  .contract td {
    padding: 5px 6px;
    border-bottom: 1px solid var(--line-soft);
    font-size: 12px;
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
  .component-entry{display:flex;flex-direction:column;gap:4px;width:100%;padding:10px 8px;text-align:left;border:0;border-bottom:1px solid #f0f0f0;background:transparent;border-radius:4px;color:#191919;font:inherit;cursor:pointer}
  .component-entry:hover:not(:disabled){background:#f5f5f5}.component-entry:focus-visible{outline:2px solid #1476ff;outline-offset:2px}.component-entry:disabled{color:#c2c2c2;cursor:not-allowed}
  .mlist b {
    font-size: 14px;
  }
  .mlist small {
    color: var(--muted);
    font-size: 12px;
  }
  .hint {
    margin: 0;
    color: var(--faint);
    font-size: 12px;
    line-height: 1.6;
  }
  .field {
    display: grid;
    gap: 5px;
  }
  .field > span {
    color: #595959;
    font-size: 14px;
  }
  .span-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #595959;
    font-size: 14px;
  }
  .span-row b {
    min-width: 38px;
    text-align: center;
    font-size: 12px;
  }
</style>
