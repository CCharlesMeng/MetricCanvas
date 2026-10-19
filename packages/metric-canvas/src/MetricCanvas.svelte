<script lang="ts">
  import { RuntimeSurface, type ComponentContent } from '@metriccanvas/engine/ui/composition';
  import type { RuntimeViewProps } from '@metriccanvas/engine/ui/types';
  import type { PageSection } from '@metriccanvas/page/internal';
  import AuthoringSection from './AuthoringSection.svelte';
  import { resolveAuthoringSections } from './authoring-layout';
  import type { AuthoringComponentLocator, AuthoringOptions } from './types';

  let { selected, draftSections, inlineControls, allowDelete, onintent, enabled = true, ...runtime }: RuntimeViewProps & AuthoringOptions & {
    /** 暂停编辑时保留同一个渲染会话，避免丢失筛选与分页状态。 */
    enabled?: boolean;
  } = $props();
  let dragSource = $state<AuthoringComponentLocator | null>(null);
  $effect(() => { if (!enabled) dragSource = null; });
  const authoring = $derived(enabled ? { selected, draftSections, inlineControls, allowDelete, onintent } : undefined);
</script>

<svelte:window ondragend={() => dragSource = null} ondrop={() => dragSource = null} />

<div class="metric-canvas" class:authoring-is-dragging={dragSource !== null}>
  <RuntimeSurface {...runtime}>
    {#snippet sectionsContent(sections: readonly PageSection[], componentContent: ComponentContent)}
      {#each resolveAuthoringSections(sections, authoring?.draftSections) as section (section.id)}
        <AuthoringSection {section} {authoring} {componentContent} {dragSource} onDragSourceChange={source => dragSource = source} />
      {/each}
    {/snippet}
  </RuntimeSurface>
</div>

<style>
  /* 创作工具配色不读取页面内容主题的 accent。 */
  .metric-canvas { --mc-authoring-accent: #246fe3; --mc-authoring-selection: linear-gradient(118deg, #176bfa 0%, #338eff 46%, #68b9ff 73%, #337cf0 100%); }
  /* ==== 创作态控件 ==== */
  .metric-canvas :global(.authoring-cell) {
    cursor: default;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  .metric-canvas :global(.authoring-cell:hover:not(.authoring-selected)) {
    border-color: #c4dcff;
  }
  .metric-canvas :global(.authoring-selected) {
    z-index: 2;
    overflow: visible;
    border-color: transparent;
    background-image: linear-gradient(118deg, rgb(29 111 255 / .045), rgb(86 174 255 / .012) 62%, transparent);
    box-shadow: 0 2px 9px rgb(29 105 218 / .055);
  }
  .metric-canvas :global(.authoring-drop-slot) {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 12;
    width: 16px;
    pointer-events: none;
  }
  .metric-canvas.authoring-is-dragging :global(.authoring-drop-slot) { pointer-events: auto; }
  .metric-canvas :global(.authoring-full-row > .authoring-drop-slot) { top: 0; right: 0; bottom: auto; left: 0; width: auto; height: 16px; }
  .metric-canvas :global(.authoring-full-row > .authoring-drop-slot-after) { top: auto; bottom: 0; }
  .metric-canvas :global(.authoring-full-row > .authoring-drop-slot::after) { right: 0; bottom: auto; width: auto; height: 3px; }
  .metric-canvas :global(.authoring-drop-slot-before) {
    left: 0;
  }
  .metric-canvas :global(.authoring-drop-slot-after) {
    right: 0;
  }
  .metric-canvas :global(.authoring-drop-slot::after) {
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
  .metric-canvas :global(.authoring-drop-slot-after::after) {
    right: 0;
    left: auto;
  }
  .metric-canvas :global(.authoring-full-row > .authoring-drop-slot-after::after) { left: 0; }
  .metric-canvas :global(.authoring-drop-slot.authoring-drop-active::after) {
    background: linear-gradient(90deg, #2276fa, #70bdff);
  }
  .metric-canvas :global(.authoring-empty-drop-slot) {
    display: grid;
    min-height: 96px;
    grid-column: 1 / -1;
    place-items: center;
    border: 1px dashed var(--mc-authoring-accent);
    border-radius: 6px;
  }
  .metric-canvas :global(.authoring-empty-drop-slot.authoring-drop-active) { border-color: #3d8af3; background: #f1f7ff; }

  .metric-canvas :global(.authoring-controls) {
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
    background: var(--mc-authoring-accent);
    border-radius: 7px;
    box-shadow: 0 3px 10px rgb(35 93 178 / .08);
    cursor: default;
  }
  .metric-canvas :global(.authoring-controls label) {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
  }
  .metric-canvas :global(.authoring-controls label span) {
    flex: none;
  }
  .metric-canvas :global(.authoring-controls input) {
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
  .metric-canvas :global(.authoring-span) {
    flex: none;
    font-size: 10px;
  }
  .metric-canvas :global(.authoring-controls button) {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    padding: 0;
    color: var(--mc-authoring-accent);
    background: var(--mc-color-surface);
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }

  .metric-canvas :global(.authoring-cell:focus-visible) { outline: 2px solid var(--mc-authoring-accent); outline-offset: 3px; }
  .metric-canvas :global(.authoring-dragging) { opacity: .4; }
  .metric-canvas :global(.authoring-toolbar) { position: absolute; top: 6px; right: 6px; z-index: 21; display: flex; gap: 2px; padding: 3px; background: var(--mc-color-surface); border: 1px solid #d8e6fa; border-radius: 5px; box-shadow: none; opacity: 0; pointer-events: none; }
  .metric-canvas :global(.authoring-cell:hover > .authoring-toolbar),
  .metric-canvas :global(.authoring-selected > .authoring-toolbar),
  .metric-canvas :global(.authoring-cell:focus-within > .authoring-toolbar) { opacity: 1; pointer-events: auto; }
  .metric-canvas :global(.authoring-toolbar button) { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; background: transparent; border: 0; border-radius: 5px; color: #5b6474; cursor: pointer; }
  .metric-canvas :global(.authoring-toolbar button:hover) { background: #eff5ff; color: var(--mc-authoring-accent); }
  .metric-canvas :global(.authoring-toolbar button:focus-visible) { outline: 2px solid var(--mc-authoring-accent); }
  .metric-canvas :global(.authoring-toolbar .authoring-drag-handle) { cursor: grab; touch-action: none; }
  .metric-canvas :global(.authoring-toolbar .authoring-delete:hover) { background: #fff1f0; color: #d43838; }
  .metric-canvas :global(.authoring-empty-drop-slot) { color: #6b7789; font-size: 12px; background: color-mix(in srgb, var(--mc-authoring-accent) 3%, transparent); }

  /* 创作态边界放在容器去镶边规则之后，确保三种内容分区都清晰可见。 */
  .metric-canvas :global(.container-plain .cell.authoring-cell),
  .metric-canvas :global(.container-panel .cell.authoring-cell),
  .metric-canvas :global(.container-card .cell.authoring-cell) {
    border: 1px solid transparent;
    border-radius: 6px;
  }
  .metric-canvas :global(.container-plain .cell.authoring-cell:hover:not(.authoring-selected)),
  .metric-canvas :global(.container-panel .cell.authoring-cell:hover:not(.authoring-selected)),
  .metric-canvas :global(.container-card .cell.authoring-cell:hover:not(.authoring-selected)) {
    border-color: #c4dcff;
  }
  .metric-canvas :global(.container-plain .cell.authoring-cell.authoring-selected),
  .metric-canvas :global(.container-panel .cell.authoring-cell.authoring-selected),
  .metric-canvas :global(.container-card .cell.authoring-cell.authoring-selected) {
    z-index: 2;
    overflow: visible;
    border-color: transparent;
    background-image: linear-gradient(118deg, rgb(29 111 255 / .045), rgb(86 174 255 / .012) 62%, transparent);
    box-shadow: 0 2px 9px rgb(29 105 218 / .055);
  }

  .metric-canvas :global(.authoring-selected::after) { content: ''; position:absolute; inset:-1px; padding:1.5px; border-radius:7px; background:var(--mc-authoring-selection); -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite:xor; mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite:exclude; pointer-events:none; z-index:22; }
</style>
