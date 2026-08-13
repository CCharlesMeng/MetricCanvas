<script lang="ts">
  import {
    isChartComponent,
    type Component,
    type PageSection
  } from '@metriccanvas/page';
  import { sectionTitleLeftUrl, sectionTitleRightUrl } from '@metriccanvas/widgets';
  import type { Snippet } from 'svelte';
  import { installRowAlignment } from './row-alignment';
  import type { AuthoringComponentLocator, AuthoringOptions } from './types';

  /**
   * 内容分区 Module:拥有 12 列 Grid(统一运行时不变量)、组件单元格、
   * `connectPrevious` 与行对齐安装点。外观唯一由 `section.container` 决定,
   * 不读取子组件的类型组合或 `props.variant` 推断父级布局(ADR-0021)。
   */
  interface Props {
    section: PageSection;
    authoring?: AuthoringOptions;
    componentContent: Snippet<[Component]>;
  }

  let { section, authoring, componentContent }: Props = $props();
  let dragged = $state<AuthoringComponentLocator | null>(null);
  let sectionGrid = $state<HTMLElement | null>(null);
  const container = $derived(section.container);

  $effect(() => {
    if (!sectionGrid) return;
    return installRowAlignment(sectionGrid);
  });

  function componentVariant(component: Component): string | undefined {
    const { variant } = component.props as { variant?: string };
    return variant;
  }

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
  class:container-plain={container === 'plain'}
  class:container-panel={container === 'panel'}
  class:container-card={container === 'card'}
  class="page-section"
  data-section-id={section.id}
  data-section-container={container}
>
  {#if section.title}
    <h2 class="section-title">
      {#if container === 'panel'}
        <img src={sectionTitleLeftUrl} alt="" data-decorative-icon="section-title-left" />
      {/if}
      <span>{section.title}</span>
      {#if container === 'panel'}
        <img src={sectionTitleRightUrl} alt="" data-decorative-icon="section-title-right" />
      {/if}
    </h2>
  {/if}
  <div bind:this={sectionGrid} class="section-grid">
    {#each section.components as component, componentIndex (component.id)}
      <article
        class:chart-cell={isChartComponent(component)}
        class:header-cell={component.type === 'reportHeader'}
        class:metric-cell={component.type === 'metricCard'}
        class:table-cell={component.type === 'table'}
        class:ranking-detail-cell={component.type === 'rankingDetailCard'}
        class:ai-summary-cell={component.type === 'aiSummary'}
        class:connect-next={section.components[componentIndex + 1]?.layout
          .connectPrevious === true}
        class:connect-previous={componentIndex > 0 &&
          component.layout.connectPrevious === true}
        class:authoring-cell={Boolean(authoring)}
        class:authoring-selected={selected(component.id)}
        class="cell"
        data-component={`${section.id}/${component.id}`}
        data-component-type={component.type}
        data-component-variant={componentVariant(component)}
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
  /* ==== 缺省容器:通用看板外观(白色分区 + 带边框组件单元格) ==== */
  .page-section {
    padding: 18px;
    border: 0;
    border-radius: var(--mc-radius-section);
    background: var(--mc-color-surface);
    box-shadow: 0 8px 24px rgb(68 85 147 / 0.06);
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
    grid-template-columns: repeat(12, minmax(0, 1fr));
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
  .chart-cell {
    min-height: 320px;
  }
  .ranking-detail-cell {
    min-height: 0;
  }
  .table-cell {
    --table-widget-radius-top-left: 16px;
    --table-widget-radius-top-right: 16px;
    --table-widget-radius-bottom-right: 16px;
    --table-widget-radius-bottom-left: 16px;

    min-height: 0;
  }
  .header-cell {
    min-height: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    border: 0;
    box-shadow: none;
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

  /* ==== 创作态控件 ==== */
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

  /* ==== 三档分区容器:单元格一律无镶边,组件自带表面 ==== */
  .container-plain .cell,
  .container-panel .cell,
  .container-card .cell {
    min-height: 0;
    gap: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .container-plain .cell.connect-previous,
  .container-panel .cell.connect-previous,
  .container-card .cell.connect-previous {
    padding-top: var(--section-grid-gap);
    background: transparent;
  }
  .container-plain .cell.connect-previous::before,
  .container-panel .cell.connect-previous::before,
  .container-card .cell.connect-previous::before {
    right: 0;
    left: 0;
  }

  /* plain:无容器,组件完全自带外观 */
  .page-section.container-plain {
    padding: 0;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
  }
  .container-plain .section-grid {
    --section-grid-gap: 12px;

    gap: 12px 14px;
  }

  /* panel:渐变章节面板 + 居中图标标题 + 内层白底
     数值真源在 RuntimeView 根部的 --mc-section-* 变量,与 ReportHeader 摘要区、
     TextBlock(heading) 共用,不得在任一消费方重写字面量。 */
  .page-section.container-panel {
    --mc-color-positive: var(--mc-color-report-positive);
    --mc-color-negative: var(--mc-color-report-negative);

    padding: var(--mc-section-panel-padding);
    background: var(--mc-section-panel-background);
    border-radius: var(--mc-radius-section);
    box-shadow: none;
  }
  .container-panel > .section-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--mc-section-title-gap);
    margin: 0 0 15px;
    color: var(--mc-color-primary);
    font-size: var(--mc-section-title-font-size);
    font-weight: 400;
    line-height: var(--mc-section-title-line-height);
    text-align: center;
  }
  .container-panel > .section-title::before {
    display: none;
  }
  .container-panel > .section-title img {
    width: var(--mc-section-title-icon-size);
    height: var(--mc-section-title-icon-size);
    flex: none;
  }
  .container-panel > .section-grid {
    --section-grid-gap: 12px;

    gap: 12px;
    padding: 25px 16px 18px;
    background: var(--mc-color-surface);
    border-radius: var(--mc-radius-section);
  }
  .container-panel .chart-cell {
    min-height: 270px;
  }

  /* card:白色小节卡片 + 左对齐小标题 */
  .page-section.container-card {
    padding: 20px;
    background: var(--mc-color-surface);
    border-radius: var(--mc-radius-section);
    box-shadow: none;
  }
  .container-card > .section-title {
    margin: 0 0 10px 9px;
    color: var(--mc-color-report-heading);
    font-size: var(--mc-font-size-report-level-3, 20px);
    font-weight: 400;
    line-height: 30px;
    text-align: left;
  }
  .container-card > .section-title::before {
    display: none;
  }
  .container-card > .section-grid {
    --section-grid-gap: 10px;

    gap: 10px 25px;
  }

  /* ==== 响应式 ==== */
  @media (max-width: 1050px) {
    .page-section.container-panel {
      padding-right: 20px;
      padding-left: 20px;
    }
    .container-panel > .section-grid {
      gap: 10px 8px;
      padding-right: 12px;
      padding-left: 12px;
    }
    .container-card > .section-grid {
      column-gap: 16px;
    }
  }
  @media (max-width: 760px) {
    .page-section {
      padding: 16px;
    }
    .page-section.container-plain {
      padding: 0;
    }
    .cell {
      grid-column: 1 / -1 !important;
    }
  }
</style>
