<script lang="ts">
  import {
    isChartComponent,
    type Component,
    type PageSection
  } from '@metriccanvas/page';
  import type { Snippet } from 'svelte';
  import type { AuthoringComponentLocator, AuthoringOptions } from './types';

  interface Props {
    section: PageSection;
    authoring?: AuthoringOptions;
    componentContent: Snippet<[Component]>;
  }

  let { section, authoring, componentContent }: Props = $props();
  let dragged = $state<AuthoringComponentLocator | null>(null);
  const summaryMetricSection = $derived(
    section.components.length > 0 &&
      section.components.every(
        (component) => component.type === 'metricCard' && component.props.variant === 'summary'
      )
  );
  const activityMetricSection = $derived(
    section.components.length > 0 &&
      section.components.every(
        (component) =>
          component.type === 'metricCard' && component.props.variant === 'activityProgress'
      )
  );

  function locator(componentId: string): AuthoringComponentLocator {
    return { sectionId: section.id, componentId };
  }

  function selected(componentId: string): boolean {
    return (
      authoring?.selected?.sectionId === section.id &&
      authoring.selected.componentId === componentId
    );
  }

  function select(event: MouseEvent, componentId: string) {
    if (!authoring || (event.target as HTMLElement).closest('.authoring-controls')) return;
    event.preventDefault();
    event.stopPropagation();
    authoring.onintent({
      type: 'select_component',
      locator: locator(componentId)
    });
  }

  function dragStart(event: DragEvent, componentId: string) {
    if (!authoring) return;
    dragged = locator(componentId);
    event.dataTransfer?.setData(
      'application/x-metriccanvas-component',
      JSON.stringify(dragged)
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function drop(event: DragEvent, componentId: string) {
    if (!authoring) return;
    event.preventDefault();
    let source = dragged;
    try {
      const encoded = event.dataTransfer?.getData(
        'application/x-metriccanvas-component'
      );
      if (encoded) source = JSON.parse(encoded) as AuthoringComponentLocator;
    } catch {
      // 拖动会话仍可使用进程内定位。
    }
    const before = locator(componentId);
    if (
      source &&
      source.sectionId === before.sectionId &&
      source.componentId !== before.componentId
    ) {
      authoring.onintent({ type: 'move_component', locator: source, before });
    }
    dragged = null;
  }

  function editTitle(event: Event, component: Component) {
    if (!authoring) return;
    const title = (event.currentTarget as HTMLInputElement).value;
    if (title === (component.props.title ?? '')) return;
    authoring.onintent({
      type: 'edit_component',
      locator: locator(component.id),
      edit: { title }
    });
  }

  function resize(component: Component, delta: number) {
    authoring?.onintent({
      type: 'edit_component',
      locator: locator(component.id),
      edit: { span: Math.min(12, Math.max(1, component.layout.span + delta)) }
    });
  }
</script>

<section
  class:header-section={section.components.length === 1 &&
    section.components[0]?.type === 'reportHeader'}
  class:titled-section={Boolean(section.title)}
  class:summary-metric-section={summaryMetricSection}
  class:activity-metric-section={activityMetricSection}
  class="page-section"
  data-section-id={section.id}
>
  {#if section.title}<h2 class="section-title">{section.title}</h2>{/if}
  <div
    class="section-grid"
    style="grid-template-columns: repeat({section.layout.columns}, minmax(0, 1fr));"
  >
    {#each section.components as component, componentIndex (component.id)}
      <article
        class:chart-cell={isChartComponent(component)}
        class:header-cell={component.type === 'reportHeader'}
        class:metric-cell={component.type === 'metricCard'}
        class:table-cell={component.type === 'table'}
        class:connect-next={section.components[componentIndex + 1]?.layout
          .connectPrevious === true}
        class:connect-previous={componentIndex > 0 &&
          component.layout.connectPrevious === true}
        class:authoring-cell={Boolean(authoring)}
        class:authoring-selected={selected(component.id)}
        class="cell"
        data-component={`${section.id}/${component.id}`}
        style={`grid-column: span ${component.layout.span};`}
        draggable={Boolean(authoring)}
        onclickcapture={(event) => select(event, component.id)}
        ondragstart={(event) => dragStart(event, component.id)}
        ondragover={(event) => {
          if (authoring) event.preventDefault();
        }}
        ondrop={(event) => drop(event, component.id)}
        ondragend={() => (dragged = null)}
      >
        {#if authoring && selected(component.id)}
          <div class="authoring-controls">
            <span class="authoring-drag" title="拖动组件">⠿</span>
            <label>
              <span>画布内标题</span>
              <input
                aria-label={`${component.id} 画布内标题`}
                value={component.props.title ?? ''}
                onchange={(event) => editTitle(event, component)}
              />
            </label>
            <span class="authoring-span">{component.layout.span}/12</span>
            <button type="button" aria-label="缩小组件" onclick={() => resize(component, -1)}>−</button>
            <button type="button" aria-label="加宽组件" onclick={() => resize(component, 1)}>＋</button>
          </div>
        {/if}
        {@render componentContent(component)}
      </article>
    {/each}
  </div>
</section>

<style>
  .page-section {
    padding: 18px;
    border: 0;
    border-radius: var(--mc-radius-section);
    background: var(--mc-color-surface);
    box-shadow: 0 8px 24px rgb(68 85 147 / 0.06);
  }
  .page-section.header-section {
    padding: 0 8px 10px;
    background: transparent;
    box-shadow: none;
  }
  .section-title {
    margin: 0 0 18px;
    color: var(--mc-color-primary);
    font-size: 20px;
    font-weight: 700;
    text-align: left;
  }
  .section-title::before {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 9px;
    border: 3px solid #7d9fff;
    border-radius: 3px 1px 3px 1px;
    content: '';
  }
  .section-grid {
    --section-grid-gap: 16px;

    display: grid;
    align-items: stretch;
    gap: var(--section-grid-gap);
  }
  .cell {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 112px;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    overflow: hidden;
    background: var(--mc-color-surface);
    border: 1px solid rgb(91 114 234 / 0.12);
    border-radius: var(--mc-radius-cell);
    box-shadow: 0 8px 22px rgb(53 65 130 / 0.06);
  }
  .metric-cell {
    background: var(--mc-color-surface-subtle);
  }
  .authoring-cell {
    cursor: pointer;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .authoring-cell:hover {
    border-color: rgb(79 70 229 / 0.45);
  }
  .authoring-selected {
    z-index: 2;
    overflow: visible;
    border-color: var(--mc-color-accent);
    box-shadow: 0 0 0 3px rgb(79 70 229 / 0.18), 0 12px 30px rgb(53 65 130 / 0.14);
  }
  .authoring-controls {
    position: absolute;
    top: -38px;
    right: -1px;
    left: -1px;
    z-index: 20;
    display: flex;
    height: 34px;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    color: #fff;
    background: #3730a3;
    border-radius: 7px;
    box-shadow: 0 8px 20px rgb(49 46 129 / 0.2);
    cursor: default;
  }
  .authoring-drag {
    padding: 0 4px;
    cursor: grab;
  }
  .authoring-controls label {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
  }
  .authoring-controls label span {
    flex: none;
  }
  .authoring-controls input {
    min-width: 80px;
    height: 24px;
    flex: 1;
    padding: 3px 7px;
    color: #27272a;
    background: var(--mc-color-surface);
    border: 0;
    border-radius: 4px;
    outline: 0;
    font: inherit;
  }
  .authoring-span {
    flex: none;
    font-size: 10px;
  }
  .authoring-controls button {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    padding: 0;
    color: #3730a3;
    background: var(--mc-color-surface);
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .chart-cell {
    min-height: 320px;
  }
  .table-cell {
    --table-widget-radius-top-left: 16px;
    --table-widget-radius-top-right: 16px;
    --table-widget-radius-bottom-right: 16px;
    --table-widget-radius-bottom-left: 16px;

    min-height: 0;
  }
  .cell.connect-next {
    --table-widget-radius-bottom-right: 0;
    --table-widget-radius-bottom-left: 0;

    border-bottom-color: transparent;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
  }
  .cell.connect-previous {
    --table-widget-radius-top-left: 0;
    --table-widget-radius-top-right: 0;

    margin-top: calc(-1 * var(--section-grid-gap));
    padding-top: calc(14px + var(--section-grid-gap));
    background: var(--mc-color-surface);
    border-top-color: transparent;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
  .cell.connect-previous::before {
    position: absolute;
    top: calc(var(--section-grid-gap) / 2);
    right: 16px;
    left: 16px;
    border-top: 1px dashed #000;
    content: '';
    pointer-events: none;
  }
  .header-cell {
    min-height: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  .page-section.summary-metric-section {
    padding: 0;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
  }
  .page-section.activity-metric-section,
  .page-section.titled-section {
    background-color: transparent;
    background-image: var(--mc-section-gradient);
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
    border-radius: var(--mc-radius-section);
    box-shadow: none;
  }
  .page-section.activity-metric-section {
    padding: 16px 17px 20px;
  }
  .page-section.titled-section {
    padding: 18px 17px 22px 16px;
  }
  .summary-metric-section .section-grid,
  .titled-section .section-grid {
    gap: 12px 14px;
  }
  .activity-metric-section .section-grid {
    gap: 12px;
  }
  .titled-section .section-title {
    margin: 0 0 11px;
    color: var(--mc-color-primary);
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
    text-align: center;
  }
  .titled-section .section-title::before {
    display: none;
  }
  .summary-metric-section .cell,
  .activity-metric-section .cell,
  .titled-section .cell {
    min-height: 0;
    gap: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .summary-metric-section .cell.connect-previous,
  .activity-metric-section .cell.connect-previous,
  .titled-section .cell.connect-previous {
    background: transparent;
  }
  .summary-metric-section .cell.connect-previous::before,
  .activity-metric-section .cell.connect-previous::before,
  .titled-section .cell.connect-previous::before {
    top: -7px;
    right: 0;
    left: 0;
    border-top-color: rgb(255 255 255 / 0.92);
  }
  @media (max-width: 760px) {
    .page-section {
      padding: 16px;
    }
    .cell {
      grid-column: 1 / -1 !important;
    }
  }
</style>
