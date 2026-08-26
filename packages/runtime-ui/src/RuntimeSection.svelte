<script lang="ts">
  import {
    isChartComponent,
    sectionBackdrop,
    type Component,
    type PageSection
  } from '@metriccanvas/page';
  import { sectionTitleLeftUrl, sectionTitleRightUrl } from '@metriccanvas/widgets';
  import type { Snippet } from 'svelte';
  import {
    authoringComponentDropIndex,
    authoringDropSlots,
    decodeAuthoringComponentLocator
  } from './authoring-layout';
  import { installRowAlignment } from './row-alignment';
  import {
    backdropSafeArea,
    safeAreaCustomProperties,
    type SafeAreaRect
  } from './backdrop-safe-area';
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
  let activeDropIndex = $state<number | null>(null);
  let sectionGrid = $state<HTMLElement | null>(null);
  const container = $derived(section.container);
  const dropSlots = $derived(authoringDropSlots(section.components.length));
  const backdropId = $derived(sectionBackdrop(section)?.id);

  $effect(() => {
    if (!sectionGrid) return;
    return installRowAlignment(sectionGrid);
  });

  /**
   * 未遮挡矩形:布局完成后量 backdrop 与浮层单元格,算出 backdrop 局部坐标系里
   * 最大的没被压住的矩形,以 IFC 约定的四个自定义属性下发给 backdrop 单元格。
   * 无解时四者一并缺席,消费方(`MapChart`)据此退回全容器渲染。
   *
   * 这里**不复用** `installRowAlignment` 的 ResizeObserver:那一处只在宽度变化
   * 超过 0.5px 时才重算(`row-alignment.ts:98-103`),而浮层高度变化不改宽度,
   * 安全区却必须跟着变。
   */
  let safeArea = $state<SafeAreaRect | null>(null);

  /**
   * 叠放容器的「分区可用高度」:分区顶边到视口底边之间还剩多少。
   * 冻结基线 R6-2 要求容器高度取它而不是一个固定下限——RED 相实测坐实,固定
   * 下限下容器由浮层内容撑成 608,在 1280×800 / 1366×768 两档分别有 38 / 70px
   * 落到视口折叠线以下,那一段里的散点看不见也点不到。
   * CSS 侧算不出这个数(它取决于分区自己的 top 偏移),所以在这里量,以自定义
   * 属性交给样式块消费。
   */
  let availableHeight = $state<number | null>(null);

  const gridStyle = $derived(
    availableHeight === null ? '' : `--mc-backdrop-available-h:${availableHeight}px;`
  );

  const safeAreaStyle = $derived(
    safeArea
      ? Object.entries(safeAreaCustomProperties(safeArea))
          .map(([name, value]) => `${name}:${value};`)
          .join('')
      : ''
  );
  const safeAreaAnchor = $derived(
    safeArea ? `${safeArea.x},${safeArea.y},${safeArea.width},${safeArea.height}` : undefined
  );

  /** 返回 true 表示高度刚被改写,需要在下一帧用新几何再量一次安全区。 */
  function measureSafeArea(grid: HTMLElement): boolean {
    const backdrop = grid.querySelector<HTMLElement>(':scope > .cell.backdrop-cell');
    if (!backdrop) {
      safeArea = null;
      availableHeight = null;
      return false;
    }
    // 先定高:容器高度变了浮层落位随之变,安全区必须用定高之后的几何算
    const gridTop = grid.getBoundingClientRect().top;
    const nextAvailable = Math.max(0, Math.round(window.innerHeight - gridTop));
    if (nextAvailable !== availableHeight) {
      availableHeight = nextAvailable;
      return true;
    }
    const frame = backdrop.getBoundingClientRect();
    const overlays = Array.from(
      grid.querySelectorAll<HTMLElement>(':scope > .cell:not(.backdrop-cell)')
    ).map((cell) => {
      const rect = cell.getBoundingClientRect();
      // 归一到 backdrop 单元格自身盒的坐标系(IFC 语义)
      return {
        x: rect.left - frame.left,
        y: rect.top - frame.top,
        width: rect.width,
        height: rect.height
      };
    });
    safeArea = backdropSafeArea(
      { x: 0, y: 0, width: frame.width, height: frame.height },
      overlays
    );
    return false;
  }

  $effect(() => {
    const grid = sectionGrid;
    // section 进入依赖:组件数量或跨列数变化时重新量测(它们会改浮层的落位)
    void section.components.length;
    void backdropId;
    if (!grid || backdropId === undefined) {
      safeArea = null;
      return;
    }

    let active = true;
    let frame: number | undefined;
    const schedule = () => {
      if (!active) return;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        // 高度刚改写时再排一帧:用生效后的几何量安全区,不用旧几何
        if (measureSafeArea(grid)) schedule();
      });
    };

    // 同步量一次:effect 在 DOM 插入之后运行,此时几何已可读,消费方在下一帧
    // 就能拿到值。随后的 rAF 再校正字体与底图懒加载引起的回流。
    measureSafeArea(grid);
    schedule();

    // 宽高任一变化都重算(与行对齐那处只看宽度不同)
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(grid);
    for (const cell of grid.querySelectorAll<HTMLElement>(':scope > .cell')) {
      resizeObserver.observe(cell);
    }
    const onResize = () => schedule();
    window.addEventListener('resize', onResize);
    void document.fonts?.ready.then(schedule);

    return () => {
      active = false;
      if (frame !== undefined) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
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

  function dragOverSlot(event: DragEvent, index: number) {
    if (!authoring) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    activeDropIndex = index;
  }

  function componentDropIndex(event: DragEvent, componentIndex: number): number {
    const element = event.currentTarget as HTMLElement;
    const bounds = element.getBoundingClientRect();
    return authoringComponentDropIndex(
      componentIndex,
      event.clientX,
      bounds.left,
      bounds.width
    );
  }

  function dragOverComponent(event: DragEvent, componentIndex: number) {
    dragOverSlot(event, componentDropIndex(event, componentIndex));
  }

  function dragLeaveComponent(event: DragEvent) {
    const current = event.currentTarget;
    if (
      current instanceof HTMLElement &&
      event.relatedTarget instanceof Node &&
      current.contains(event.relatedTarget)
    ) {
      return;
    }
    activeDropIndex = null;
  }

  function dropOnComponent(event: DragEvent, componentIndex: number) {
    dropAt(event, componentDropIndex(event, componentIndex));
  }

  function dragLeaveSlot(event: DragEvent, index: number) {
    const current = event.currentTarget;
    if (
      current instanceof HTMLElement &&
      event.relatedTarget instanceof Node &&
      current.contains(event.relatedTarget)
    ) {
      return;
    }
    if (activeDropIndex === index) activeDropIndex = null;
  }

  function dropAt(event: DragEvent, index: number) {
    if (!authoring) return;
    event.preventDefault();
    event.stopPropagation();
    const encoded = event.dataTransfer?.getData(
      'application/x-metriccanvas-component'
    ) ?? '';
    const source = decodeAuthoringComponentLocator(encoded) ?? dragged;
    if (source) {
      authoring.onintent({
        type: 'move_component',
        locator: source,
        destination: { sectionId: section.id, index }
      });
    }
    clearDragState();
  }

  function clearDragState() {
    dragged = null;
    activeDropIndex = null;
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

<svelte:window ondragend={clearDragState} />

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
  <div
    bind:this={sectionGrid}
    class:has-backdrop={backdropId !== undefined}
    class="section-grid"
    style={gridStyle}
  >
    {#if authoring && section.components.length === 0}
      <div
        role="presentation"
        class:authoring-drop-active={activeDropIndex === dropSlots[0]}
        class="authoring-empty-drop-slot"
        data-drop-slot
        data-drop-index={dropSlots[0]}
        data-drop-active={activeDropIndex === dropSlots[0]}
        ondragenter={(event) => dragOverSlot(event, dropSlots[0] ?? 0)}
        ondragover={(event) => dragOverSlot(event, dropSlots[0] ?? 0)}
        ondragleave={(event) => dragLeaveSlot(event, dropSlots[0] ?? 0)}
        ondrop={(event) => dropAt(event, dropSlots[0] ?? 0)}
      ></div>
    {/if}
    {#each section.components as component, componentIndex (component.id)}
      <article
        class:chart-cell={isChartComponent(component)}
        class:header-cell={component.type === 'reportHeader'}
        class:metric-cell={component.type === 'metricCard' || component.type === 'gauge'}
        class:table-cell={component.type === 'table' || component.type === 'tabContainer'}
        class:ranking-detail-cell={component.type === 'rankingDetailCard'}
        class:ai-summary-cell={component.type === 'aiSummary'}
        class:composite-cell={component.type === 'compositeCard'}
        class:connect-next={section.components[componentIndex + 1]?.layout
          .connectPrevious === true}
        class:connect-previous={componentIndex > 0 &&
          component.layout.connectPrevious === true}
        class:authoring-cell={Boolean(authoring)}
        class:authoring-selected={selected(component.id)}
        class:backdrop-cell={component.id === backdropId}
        class="cell"
        data-component={`${section.id}/${component.id}`}
        data-component-type={component.type}
        data-component-variant={componentVariant(component)}
        data-backdrop-safe={component.id === backdropId ? safeAreaAnchor : undefined}
        style={`grid-column: span ${component.layout.span};${
          component.id === backdropId ? safeAreaStyle : ''
        }`}
        draggable={Boolean(authoring)}
        onclickcapture={(event) => select(event, component.id)}
        ondragstart={(event) => dragStart(event, component.id)}
        ondragenter={(event) => dragOverComponent(event, componentIndex)}
        ondragover={(event) => dragOverComponent(event, componentIndex)}
        ondragleave={dragLeaveComponent}
        ondrop={(event) => dropOnComponent(event, componentIndex)}
        ondragend={clearDragState}
      >
        {#if authoring}
          <div
            role="presentation"
            class:authoring-drop-active={activeDropIndex === componentIndex}
            class="authoring-drop-slot authoring-drop-slot-before"
            data-drop-slot
            data-drop-index={componentIndex}
            data-drop-active={activeDropIndex === componentIndex}
            ondragenter={(event) => dragOverSlot(event, componentIndex)}
            ondragover={(event) => dragOverSlot(event, componentIndex)}
            ondragleave={(event) => dragLeaveSlot(event, componentIndex)}
            ondrop={(event) => dropAt(event, componentIndex)}
          ></div>
          {#if componentIndex === section.components.length - 1}
            <div
              role="presentation"
              class:authoring-drop-active={activeDropIndex === dropSlots.at(-1)}
              class="authoring-drop-slot authoring-drop-slot-after"
              data-drop-slot
              data-drop-index={dropSlots.at(-1)}
              data-drop-active={activeDropIndex === dropSlots.at(-1)}
              ondragenter={(event) => dragOverSlot(event, dropSlots.at(-1) ?? 0)}
              ondragover={(event) => dragOverSlot(event, dropSlots.at(-1) ?? 0)}
              ondragleave={(event) => dragLeaveSlot(event, dropSlots.at(-1) ?? 0)}
              ondrop={(event) => dropAt(event, dropSlots.at(-1) ?? 0)}
            ></div>
          {/if}
        {/if}
        {#if authoring && (authoring.inlineControls ?? true) && selected(component.id)}
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
  /* ==== 缺省容器:通用看板外观 ====
     报表形态下是「白色分区 + 带边框组件单元格」;看板形态把分区外壳让给画布,
     由单元格自己成为模块卡片。两者都是「通用看板外观」的同一档,只是形态不同,
     因此走 --mc-section-default-* / --mc-cell-* 覆写而不是新增容器档位。 */
  .page-section {
    padding: var(--mc-section-default-padding, 18px);
    border: 0;
    border-radius: var(--mc-radius-section);
    background: var(--mc-section-default-surface, var(--mc-color-surface));
    box-shadow: var(--mc-section-default-shadow, 0 8px 24px rgb(68 85 147 / 0.06));
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
    padding: var(--mc-cell-padding, 14px 16px);
    overflow: hidden;
    background: var(--mc-cell-surface, var(--mc-color-surface));
    /* 两档形态取值不同的只有宽度(看板形态无边框),色两档同为这一个值,
       因此色留字面量;只把色改透明达不到「无边框」,会留下 1px 的占位。 */
    border: var(--mc-cell-border-width, 1px) solid rgb(91 114 234 / 0.12);
    border-radius: var(--mc-cell-radius, var(--mc-radius-cell));
    box-shadow: var(--mc-cell-shadow, 0 8px 22px rgb(53 65 130 / 0.06));
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
  /* 组合卡自带卡壳,单元格因此让出全部外观——否则缺省容器下(单元格本身就是
     一张白卡)会是卡里套卡。三档分区容器已经统一去了镶边,这一条补的是缺省档。 */
  .composite-cell {
    min-height: 0;
    padding: 0;
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
    /* 卡内分隔线:两档形态取值不同,缺省值即报表形态的既有取值。 */
    border-top: 1px dashed var(--mc-cell-divider-color, #000);
    content: '';
    pointer-events: none;
  }

  /* ==== 叠放层:一个组件铺满分区,其余组件按 12 列网格叠在它之上 ====
     backdrop 用 auto 网格定位换取「包含块是网格容器的 padding box」,
     因此它铺满的是整个分区而不是自己那几列。窄屏退化见文件末尾。 */
  .section-grid.has-backdrop {
    position: relative;
    /* 建立层叠上下文:backdrop 单元格内部的定位后代(图例、面包屑)否则能越过
       浮层单元格——`position: relative` 不带 `z-index` 并不建立层叠上下文。 */
    isolation: isolate;
    /* 下限取「分区可用高度」(分区顶边到视口底边),由脚本量出后以自定义属性
       下发,取不到时回落到原来的固定值。
       **只写 min-height,不写 height**:容器一旦定高,网格的隐式行会被压到
       「容器高度减去下一行的最小高度」——实测在 1280×800 下浮层指标卡从 272
       被压到 30。浮层要保持自然高度,所以容器只设下限、允许被内容撑高;
       真正需要收在折叠线以内的是底图那一层,见 .backdrop-cell。 */
    min-height: var(--mc-backdrop-available-h, 560px);
    /* 容器比内容高时,行按内容起排,余下的空间露出底图,而不是把卡片抽长。 */
    align-content: start;
  }
  .section-grid.has-backdrop > .cell {
    position: relative;
    z-index: 1;
  }
  /* 底图层收在「分区可用高度」以内:容器可以被浮层内容撑到折叠线以下,底图
     不能——落到折叠线以下的那一段里,散点看不见也点不到(RED 相实测 1280 有
     38px、1366 有 70px 落在线下)。取不到可用高度时退回铺满容器。 */
  .section-grid.has-backdrop > .cell.backdrop-cell {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 0;
    height: var(--mc-backdrop-available-h, 100%);
    grid-column: auto !important;
  }
  /* 叠放分区里的 Tab 卡纵向档位(冻结基线 R3-1,用户 2026-08-24 决定的 524):
     顶边由上一行 + 网格间距决定,这里只定高。按组件类型选中而不是按类名,
     `table-cell` 同时覆盖 table 与 tabContainer 两类。 */
  .section-grid.has-backdrop > .cell[data-component-type='tabContainer'] {
    min-height: 524px;
  }

  /* ==== 创作态控件 ==== */
  .authoring-cell {
    cursor: grab;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .authoring-cell:active {
    cursor: grabbing;
  }
  .authoring-cell:hover:not(.authoring-selected) {
    border-color: var(--mc-color-accent);
  }
  .authoring-selected {
    z-index: 2;
    overflow: visible;
    border-color: var(--mc-color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent);
  }
  .authoring-drop-slot {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 12;
    width: 24px;
  }
  .authoring-drop-slot-before {
    left: 0;
  }
  .authoring-drop-slot-after {
    right: 0;
  }
  .authoring-drop-slot::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 2px;
    background: transparent;
    border-radius: 999px;
    content: '';
    pointer-events: none;
  }
  .authoring-drop-slot-after::after {
    right: 0;
    left: auto;
  }
  .authoring-drop-slot.authoring-drop-active::after {
    background: var(--mc-color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent);
  }
  .authoring-empty-drop-slot {
    display: grid;
    min-height: 96px;
    grid-column: 1 / -1;
    place-items: center;
    border: 1px dashed var(--mc-color-accent);
    border-radius: var(--mc-radius-cell);
  }
  .authoring-empty-drop-slot.authoring-drop-active {
    border-color: var(--mc-color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent);
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
    --section-grid-gap: var(--mc-section-plain-grid-gap, 12px);

    gap: var(--mc-section-plain-grid-gap, 12px)
      var(--mc-section-plain-grid-column-gap, 14px);
  }

  /* panel:渐变章节面板 + 居中图标标题 + 内层白底
     数值真源在 RuntimeView 根部的 --mc-section-* 变量,与 ReportHeader 摘要区、
     TextBlock(heading) 共用,不得在任一消费方重写字面量。 */
  .page-section.container-panel {
    --mc-color-positive: var(--mc-color-report-positive);
    --mc-color-negative: var(--mc-color-report-negative);

    padding: var(--mc-section-panel-padding);
    background: var(--mc-section-panel-background);
    border-radius: var(--mc-section-panel-radius, var(--mc-radius-section));
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
    font-weight: var(--mc-section-title-font-weight, 600);
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
  .container-panel .cell[data-component-variant='reportForecast'],
  .container-panel .cell[data-component-variant='riskNotice'] {
    margin-top: calc(15px - var(--section-grid-gap));
  }
  .container-panel .cell[data-component-variant='riskNotice']
    + .chart-cell[data-component-variant='reportForecast'] {
    margin-top: calc(2px - var(--section-grid-gap));
  }

  /* card:白色小节卡片 + 左对齐小标题
     内边距、标题字号与网格间距经 --mc-section-card-* 可被页面布局形态覆写,
     缺省值即报表形态的既有观感;真源在 RuntimeView 根部,不在这里改字面量。 */
  .page-section.container-card {
    padding: var(--mc-section-card-padding, 20px);
    background: var(--mc-color-surface);
    border-radius: var(--mc-radius-section);
    box-shadow: none;
  }
  .container-card > .section-title {
    margin: var(--mc-section-card-title-margin, 0 0 10px 9px);
    color: var(--mc-section-card-title-color, var(--mc-color-report-heading));
    font-size: var(
      --mc-section-card-title-font-size,
      var(--mc-font-size-report-level-3, 20px)
    );
    font-weight: var(--mc-section-card-title-font-weight, 400);
    line-height: var(--mc-section-card-title-line-height, 30px);
    text-align: left;
  }
  .container-card > .section-title::before {
    display: none;
  }
  .container-card > .section-grid {
    --section-grid-gap: var(--mc-section-card-grid-gap, 10px);

    gap: var(--mc-section-card-grid-gap, 10px)
      var(--mc-section-card-grid-column-gap, 25px);
  }

  /* 创作态边界放在容器去镶边规则之后，确保三种内容分区都清晰可见。 */
  .container-plain .cell.authoring-cell,
  .container-panel .cell.authoring-cell,
  .container-card .cell.authoring-cell {
    border: 1px solid transparent;
    border-radius: var(--mc-radius-cell);
  }
  .container-plain .cell.authoring-cell:hover:not(.authoring-selected),
  .container-panel .cell.authoring-cell:hover:not(.authoring-selected),
  .container-card .cell.authoring-cell:hover:not(.authoring-selected) {
    border-color: var(--mc-color-accent);
  }
  .container-plain .cell.authoring-cell.authoring-selected,
  .container-panel .cell.authoring-cell.authoring-selected,
  .container-card .cell.authoring-cell.authoring-selected {
    z-index: 2;
    overflow: visible;
    border-color: var(--mc-color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent);
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
    /* 单列宽度下叠放会让底层组件被完全遮住,因此窄屏一律取消叠放:
       backdrop 回到普通流,按它在组件数组中的位置与其余组件上下排列。
       回流后分区高度重新由内容决定,而铺满时不占高度的组件需要自己拿到
       一个高度下限,否则会被压成零高。 */
    .section-grid.has-backdrop {
      min-height: 0;
    }
    .section-grid.has-backdrop > .cell.backdrop-cell {
      position: static;
      min-height: 320px;
      inset: auto;
    }
  }
</style>
