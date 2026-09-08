<script lang="ts">
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { MetricCanvas, normalizeAuthoringDropTarget, type AuthoringComponentLocator, type AuthoringDraftSection, type AuthoringIntent } from '@metriccanvas/metric-canvas';
  import { document, gateway, validDocument } from './document';

  let current = $state.raw(validDocument(document));
  let selected = $state<AuthoringComponentLocator>();
  let enabled = $state(true);
  let inlineControls = $state(true);
  let mounted = $state(true);
  let draftSections = $state<AuthoringDraftSection[]>();
  let intents = $state<AuthoringIntent[]>([]);
  let calls = $state({ canvas: 0, runtime: 0 });
  const canvasGateway = gateway(() => calls.canvas += 1);
  const runtimeGateway = gateway(() => calls.runtime += 1);

  function onintent(intent: AuthoringIntent) {
    intents.push(intent);
    if (intent.type === 'select_component') selected = intent.locator;
    if (intent.type === 'edit_component') {
      current = validDocument({ ...current, sections: current.sections.map((section) => ({ ...section,
        components: section.components.map((component) => component.id === intent.locator.componentId ? {
          ...component, props: { ...component.props, ...(intent.edit.title === undefined ? {} : { title: intent.edit.title }) },
          layout: { ...component.layout, ...(intent.edit.span === undefined ? {} : { span: intent.edit.span }) }
        } : component)
      })) });
    }
    if (intent.type === 'move_component' && draftSections) {
      const from = draftSections.find((section) => section.id === intent.locator.sectionId)!;
      const to = draftSections.find((section) => section.id === intent.destination.sectionId)!;
      const index = from.componentIds.indexOf(intent.locator.componentId);
      const target = normalizeAuthoringDropTarget({ sectionId: from.id, index }, intent.destination, to.componentIds.length);
      if (target.kind !== 'move') return;
      draftSections = draftSections.map((section) => {
        const ids = section.componentIds.filter((id) => id !== intent.locator.componentId);
        if (section.id === to.id) ids.splice(target.destination.index, 0, intent.locator.componentId);
        return { ...section, componentIds: ids };
      });
    }
  }
</script>

<nav>
  <button onclick={() => enabled = !enabled}>切换编辑</button>
  <button onclick={() => inlineControls = !inlineControls}>切换控件</button>
  <button onclick={() => mounted = !mounted}>挂载开关</button>
  <button onclick={() => draftSections = [
    ...current.sections.map((section) => ({ id: section.id, title: section.title, container: section.container, componentIds: section.components.map((component) => component.id) })),
    { id: 'empty', title: '草稿空分区', container: 'card', componentIds: [] }
  ]}>添加空分区</button>
  <button onclick={() => draftSections = [{ id: 'bad', componentIds: ['missing'] }]}>无效草稿</button>
  <button onclick={() => current = validDocument({ ...document, id: 'replacement' })}>替换文档</button>
</nav>
<output data-calls>{JSON.stringify(calls)}</output>
<output data-intents>{JSON.stringify(intents)}</output>
<div id="canvas">
  {#if mounted}
    <MetricCanvas document={current} dataGateway={canvasGateway} {selected} {enabled} {inlineControls} {draftSections} {onintent} />
  {/if}
</div>
<div id="runtime"><RuntimeView document={current} dataGateway={runtimeGateway} /></div>

<style>
  nav { display: flex; gap: 10px; margin: 12px 0; }
  #canvas, #runtime { width: 1200px; margin: 20px 0; }
  output { display: block; }
</style>
