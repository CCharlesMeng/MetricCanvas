<script lang="ts">
  import { RuntimeSurface, type ComponentContent } from '@metriccanvas/engine/ui/composition';
  import type { RuntimeViewProps } from '@metriccanvas/engine/ui/types';
  import type { PageSection } from '@metriccanvas/page';
  import AuthoringSection from './AuthoringSection.svelte';
  import { resolveAuthoringSections } from './authoring-layout';
  import type { AuthoringOptions } from './types';

  let { selected, draftSections, inlineControls, onintent, enabled = true, ...runtime }: RuntimeViewProps & AuthoringOptions & {
    /** 暂停编辑时保留同一个渲染会话，避免丢失筛选与分页状态。 */
    enabled?: boolean;
  } = $props();
  const authoring = $derived(enabled ? { selected, draftSections, inlineControls, onintent } : undefined);
</script>

<div class="metric-canvas">
  <RuntimeSurface {...runtime}>
    {#snippet sectionsContent(sections: readonly PageSection[], componentContent: ComponentContent)}
      {#each resolveAuthoringSections(sections, authoring?.draftSections) as section (section.id)}
        <AuthoringSection {section} {authoring} {componentContent} />
      {/each}
    {/snippet}
  </RuntimeSurface>
</div>

<style>
  /* ==== 创作态控件 ==== */
  .metric-canvas :global(.authoring-cell) {
    cursor: grab;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .metric-canvas :global(.authoring-cell:active) {
    cursor: grabbing;
  }
  .metric-canvas :global(.authoring-cell:hover:not(.authoring-selected)) {
    border-color: var(--mc-color-accent);
  }
  .metric-canvas :global(.authoring-selected) {
    z-index: 2;
    overflow: visible;
    border-color: var(--mc-color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent);
  }
  .metric-canvas :global(.authoring-drop-slot) {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 12;
    width: 24px;
  }
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
  .metric-canvas :global(.authoring-drop-slot.authoring-drop-active::after) {
    background: var(--mc-color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent);
  }
  .metric-canvas :global(.authoring-empty-drop-slot) {
    display: grid;
    min-height: 96px;
    grid-column: 1 / -1;
    place-items: center;
    border: 1px dashed var(--mc-color-accent);
    border-radius: var(--mc-radius-cell);
  }
  .metric-canvas :global(.authoring-empty-drop-slot.authoring-drop-active) {
    border-color: var(--mc-color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent);
  }
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
    background: #3730a3;
    border-radius: 7px;
    box-shadow: 0 8px 20px rgb(49 46 129 / 0.2);
    cursor: default;
  }
  .metric-canvas :global(.authoring-drag) {
    padding: 0 4px;
    cursor: grab;
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
    color: #3730a3;
    background: var(--mc-color-surface);
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }

  /* 创作态边界放在容器去镶边规则之后，确保三种内容分区都清晰可见。 */
  .metric-canvas :global(.container-plain .cell.authoring-cell),
  .metric-canvas :global(.container-panel .cell.authoring-cell),
  .metric-canvas :global(.container-card .cell.authoring-cell) {
    border: 1px solid transparent;
    border-radius: var(--mc-radius-cell);
  }
  .metric-canvas :global(.container-plain .cell.authoring-cell:hover:not(.authoring-selected)),
  .metric-canvas :global(.container-panel .cell.authoring-cell:hover:not(.authoring-selected)),
  .metric-canvas :global(.container-card .cell.authoring-cell:hover:not(.authoring-selected)) {
    border-color: var(--mc-color-accent);
  }
  .metric-canvas :global(.container-plain .cell.authoring-cell.authoring-selected),
  .metric-canvas :global(.container-panel .cell.authoring-cell.authoring-selected),
  .metric-canvas :global(.container-card .cell.authoring-cell.authoring-selected) {
    z-index: 2;
    overflow: visible;
    border-color: var(--mc-color-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent) 18%, transparent);
  }

</style>
