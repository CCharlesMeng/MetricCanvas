<script lang="ts">
  import {presentationControls} from './property-edit';
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
  import type { AuthoringIntent } from '@metriccanvas/metric-canvas/types';
  import {componentListMove} from './component-list-order';
  import type {ConditionFilter} from './condition-editor';

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
    onMoveComponent,
    onEdit,
    properties = [],
    onPropertyEdit, dateDraft, onDateEdit, onClearSelection
  }: {
    onClearSelection?: () => void;
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
    onMoveComponent?: (intent: Extract<AuthoringIntent, {type: 'move_component'}>) => void;
    onEdit: (edit: { title?: string; span?: number }) => void;
    properties?: PropertyControl[];
    onPropertyEdit?: (edit: PropertyEdit) => string|void;
  } = $props();
  let tab = $state<'component' | 'page'>('component');
  let previousSelection: string | undefined;
  $effect(() => {
    const componentId = selected?.componentId;
    if (componentId && componentId !== previousSelection) tab = 'component';
    previousSelection = componentId;
  });
  const widthPresets = $derived([...new Set([Math.max(1, Math.round(selectedColumnCount / 4)), Math.max(1, Math.round(selectedColumnCount / 3)), Math.max(1, Math.round(selectedColumnCount / 2)), selectedColumnCount])]);
  const filters=$derived((dateDraft?.pageDocument.filters??[]) as ConditionFilter[]);
  const availableCandidates=$derived(candidates.filter(candidate=>candidate.ok));
  const unavailableCandidates=$derived(candidates.filter(candidate=>!candidate.ok));
  const currentCandidate=$derived(candidates.find(candidate=>candidate.type===selectedView?.componentType));
  let draggingId = $state<string | null>(null);
  let dropTarget = $state<{componentId: string; after: boolean} | null>(null);
  let orderList = $state<HTMLUListElement | null>(null);
  let dragSession: {componentId: string; pointerId: number; x: number; y: number} | null = null;
  let suppressClick = false;
  $effect(() => { if (busy) clearListDrag(); });

  function clearListDrag() { dragSession = null; draggingId = null; dropTarget = null; }

  function startListDrag(event: PointerEvent, componentId: string) {
    suppressClick = false;
    if (busy || !onMoveComponent || !dateDraft || event.button !== 0) return;
    dragSession = {componentId, pointerId: event.pointerId, x: event.clientX, y: event.clientY};
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function listDropIntent(event: PointerEvent) {
    if (busy || !draggingId || !dateDraft) return null;
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-order-component]');
    if (!(element instanceof HTMLElement) || !orderList?.contains(element)) return null;
    const componentId = element.dataset.orderComponent!;
    const bounds = element.getBoundingClientRect();
    const after = event.clientY >= bounds.top + bounds.height / 2;
    const intent = componentListMove(dateDraft.authoringSections, draggingId, componentId, after);
    return intent ? {intent, target: {componentId, after}} : null;
  }

  function overListItem(event: PointerEvent) {
    if (!dragSession || event.pointerId !== dragSession.pointerId) return;
    if (!draggingId && Math.hypot(event.clientX - dragSession.x, event.clientY - dragSession.y) < 6) return;
    draggingId = dragSession.componentId;
    suppressClick = true;
    event.preventDefault();
    dropTarget = listDropIntent(event)?.target ?? null;
    scrollListEdge(event);
  }

  function scrollListEdge(event: PointerEvent) {
    const container = orderList?.closest('.inspector-content');
    if (!(container instanceof HTMLElement)) return;
    const bounds = container.getBoundingClientRect();
    if (event.clientY < bounds.top + 40) container.scrollTop -= 16;
    else if (event.clientY > bounds.bottom - 40) container.scrollTop += 16;
  }

  function dropListItem(event: PointerEvent) {
    if (!dragSession || event.pointerId !== dragSession.pointerId) return;
    const drop = listDropIntent(event);
    clearListDrag();
    if (drop) onMoveComponent?.(drop.intent);
  }

  function selectListItem(event: MouseEvent, componentId: string) {
    if (suppressClick && event.detail > 0) return;
    onSelectComponent(componentId);
  }
</script>

<aside class="inspector">
  <header>
    <div class="inspector-heading"><b>页面配置</b><span>{pageModel?.components.length ?? 0} 个组件</span></div>
    <p>选择组件，调整布局与展示效果</p>
    <div class="panel-tabs" role="group" aria-label="配置范围">
      <button type="button" class:active={tab === 'component'} aria-pressed={tab === 'component'} onclick={() => tab = 'component'}>组件配置</button>
      <button type="button" class:active={tab === 'page'} aria-pressed={tab === 'page'} onclick={() => tab = 'page'}>页面属性</button>
    </div>
    {#if selected && pageModel}
      <div class="component-switch">
      <Select label="切换组件" value={selected.componentId} disabled={busy} options={pageModel.components.map(component=>({value:component.componentId,label:component.title??component.componentLabel}))} onchange={onSelectComponent}/>
      </div>
    {/if}
  </header>

  <div class="inspector-content">
  {#if tab === 'page'}
    <div class="panel">
      {#if dateDraft && onPropertyEdit}<ComponentProperties controls={presentationControls(dateDraft)} {filters} {busy} onEdit={onPropertyEdit}/>{/if}
      {#if dateDraft?.pageDocument.layout === 'dashboard' && onDateEdit}
        <ReportDateProperties draft={dateDraft} locator={null} {busy} onEdit={onDateEdit}/>
      {:else}
        <div class="empty-state"><b>页面属性</b><p>页面标题可在画布顶部修改，确认保存后生效。报告日期筛选请选中报告页头后配置。</p></div>
      {/if}
    </div>
  {:else if !pageModel}
    <div class="panel">
      <p class="hint">页面文档就绪后,这里可以配置每个组件。</p>
    </div>
  {:else if selected && selectedView}
    <div class="panel">
      <div class="selection-header">
        <button type="button" class="back-link" disabled={busy} onclick={onClearSelection}>‹ 全部组件</button>
        <span class="selection-type">{selectedView.componentLabel}属性</span>
      </div>

      {#if candidates.length}
      <section>
        <h5>组件形态</h5>
        <Select label="组件形态" value={selectedView.componentType} disabled={busy} options={[...(currentCandidate&&!currentCandidate.ok?[{value:currentCandidate.type,label:currentCandidate.label+' · 当前形态',disabled:true}]:[]),...availableCandidates.map(candidate=>({value:candidate.type,label:candidate.label+(candidate.recommended?' · 推荐':'')}))]} onchange={value=>{const candidate=availableCandidates.find(item=>item.type===value);if(candidate)onSelectType(candidate.type);}}/>
        <p class="hint">可用形态取决于当前组件的数据。</p>
        {#if unavailableCandidates.length}
          <details><summary>查看不可用形态及原因（{unavailableCandidates.length}）</summary>
            <ul>{#each unavailableCandidates as candidate(candidate.type)}<li><b>{candidate.label}</b><ul>{#each candidate.reasons as reason}<li>{reason}</li>{/each}</ul></li>{/each}</ul>
          </details>
        {/if}
      </section>
      {/if}

      <section>
        <h5>布局</h5>
        <label class="field">
          <span>组件标题</span>
          <Input label="组件标题" value={selectedView.title??''} placeholder="留空使用默认标题" disabled={busy} oncommit={value=>onEdit({title:value})}/>
        </label>
        {#if selectedSpan !== null}
          <div class="width-presets" role="group" aria-label="常用组件宽度">
            {#each widthPresets as span}
              <button type="button" class:active={selectedSpan === span} aria-pressed={selectedSpan === span} disabled={busy} onclick={() => onEdit({span})}>{span === selectedColumnCount ? '整行' : `${span}/${selectedColumnCount}`}</button>
            {/each}
          </div>
          <div class="span-row">
            <span>宽度</span>
            <ToolAction icon="minus" iconOnly ariaLabel="缩小组件" disabled={busy||selectedSpan<=1} onclick={()=>onEdit({span:selectedSpan!-1})}/>
            <b>{selectedSpan}/{selectedColumnCount}</b>
            <ToolAction icon="plus" iconOnly ariaLabel="加宽组件" disabled={busy||selectedSpan>=selectedColumnCount} onclick={()=>onEdit({span:selectedSpan!+1})}/>
          </div>
        {/if}
      </section>

      {#if onPropertyEdit}<ComponentProperties controls={properties} {filters} {busy} onEdit={onPropertyEdit} />{/if}
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

      <p class="hint interaction-hint">从组件手柄拖动可跨分区排列；选中后的上移、下移与删除在画布操作条完成。修改可通过顶部撤销恢复。</p>
    </div>
  {:else}
    <div class="panel">
      <section>
        <div class="list-heading"><h5>页面组件</h5><span>{pageModel.components.length}</span></div>
        <p class="hint">上下拖动组件调整顺序，点击组件进入配置。修改可通过顶部撤销恢复。</p>
        <ul class="mlist" bind:this={orderList}>
          {#each pageModel.components as component (component.componentId)}
            <li>
              <button type="button" class="component-entry" disabled={busy}
                draggable="false" data-order-component={component.componentId}
                class:dragging={draggingId === component.componentId}
                class:drop-before={dropTarget?.componentId === component.componentId && !dropTarget.after}
                class:drop-after={dropTarget?.componentId === component.componentId && dropTarget.after}
                onpointerdown={event => startListDrag(event, component.componentId)}
                onpointermove={overListItem}
                onpointerup={dropListItem}
                onpointercancel={clearListDrag}
                onlostpointercapture={clearListDrag}
                onclick={event => selectListItem(event, component.componentId)}>
                <span class="entry-icon" aria-hidden="true">▤</span>
                <span class="entry-copy"><b>{component.title ?? component.componentLabel}</b>
                <small>
                  {component.componentLabel}{component.dataSourceId
                    ? ` · ${component.dataSourceId}`
                    : ''}
                </small></span><span class="entry-arrow" aria-hidden="true">›</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    </div>
  {/if}
  </div>
</aside>

<style>
  .inspector { display:flex; flex-direction:column; min-width:0; min-height:0; height:100%; background:var(--surface,#fff); border-left:1px solid var(--line,#e5e8ef); }
  header { flex:none; padding:18px 16px 0; border-bottom:1px solid var(--line,#e5e8ef); }
  .inspector-heading,.list-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .inspector-heading b { font-size:14px; color:#202938; }
  .inspector-heading > span,.list-heading > span { font-size:11px; color:#7b8494; }
  header p { margin:6px 0 14px; color:var(--faint,#7b8494); font-size:12px; }
  .panel-tabs { display:flex; gap:20px; }
  .component-switch { padding:12px 0; }
  .panel-tabs button { padding:0 0 11px; border:0; border-bottom:2px solid transparent; background:transparent; font:inherit; font-size:12px; color:#7b8494; cursor:pointer; }
  .panel-tabs button.active { border-bottom-color:#1476ff; color:#1476ff; font-weight:600; }
  .inspector-content { flex:1; min-height:0; overflow-y:auto; scrollbar-width:thin; }
  .panel { display:flex; flex-direction:column; gap:20px; padding:16px; }
  .selection-header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:0 0 13px; border-bottom:1px solid #eef0f4; font-size:12px; color:#59677a; }
  .back-link { border:0; background:transparent; padding:5px 0; color:#8490a0; font:inherit; cursor:pointer; }
  .selection-type { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  button:focus-visible { outline:2px solid #1476ff; outline-offset:2px; }
  section { display:grid; gap:10px; }
  .panel > section { padding-bottom:18px; border-bottom:1px solid #eef0f4; }
  h5 { margin:0; color:#303b4d; font-size:12px; font-weight:600; }
  .field { display:grid; gap:7px; }
  .field > span { font-size:12px; color:#647084; }
  .width-presets { display:flex; gap:4px; padding:3px; border-radius:7px; background:#f3f5f8; }
  .width-presets button { flex:1; padding:6px 0; border:0; border-radius:5px; background:transparent; color:#737f91; font-size:11px; cursor:pointer; }
  .width-presets button.active { color:#1476ff; background:#fff; box-shadow:0 1px 4px #25385815; }
  .span-row { display:flex; align-items:center; gap:8px; color:#737f91; font-size:12px; }
  .span-row > span { flex:1; }
  .span-row b { min-width:34px; text-align:center; font-size:11px; color:#42516a; }
  .hint { margin:0; color:var(--faint,#8a94a5); font-size:11px; line-height:1.7; }
  .interaction-hint { padding:10px 12px; border-radius:8px; background:#f7f9fc; }
  .kv { display:grid; gap:6px; margin:0; }
  .kv > div { display:grid; grid-template-columns:48px minmax(0,1fr); gap:8px; }
  .kv dt { color:var(--faint); font-size:11px; }
  .kv dd { margin:0; font-size:11px; overflow-wrap:anywhere; }
  .kv code { padding:2px 5px; background:#f3f5f8; border-radius:4px; font-size:11px; }
  .contract { width:100%; border-collapse:collapse; table-layout:fixed; }
  .contract th,.contract td { padding:7px 4px; border-bottom:1px solid #f0f2f5; font-size:11px; text-align:left; overflow-wrap:anywhere; }
  .contract th { color:#8590a1; font-weight:500; background:#f8f9fc; }
  .contract td { color:#5f6e83; }
  .contract th:first-child { width:44%; }
  .mlist { display:grid; gap:8px; margin:0; padding:0; list-style:none; }
  .component-entry { display:flex; align-items:center; gap:10px; width:100%; padding:12px 10px; text-align:left; border:1px solid #e9edf3; background:#fff; border-radius:9px; color:#303b4d; font:inherit; cursor:pointer; transition:border-color .15s,background .15s; }
  .component-entry:hover:not(:disabled) { background:#f7faff; border-color:#bfd6fc; }
  .component-entry:not(:disabled) { cursor:grab; touch-action:none; user-select:none; }
  .component-entry.dragging { opacity:.45; cursor:grabbing; }
  .component-entry.drop-before { box-shadow:0 -3px 0 #1476ff; }
  .component-entry.drop-after { box-shadow:0 3px 0 #1476ff; }
  .entry-icon { display:grid; place-items:center; width:30px; height:30px; flex:none; background:#f0f5ff; border-radius:7px; color:#6891ca; }
  .entry-copy { display:grid; gap:4px; min-width:0; flex:1; }
  .entry-copy b { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
  .entry-copy small { font-size:10px; color:#8a94a5; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .entry-arrow { color:#a4b0c2; }
  .empty-state { padding:20px 4px; color:#68788d; font-size:12px; line-height:1.8; }
  .empty-state b { color:#303b4d; }
</style>
