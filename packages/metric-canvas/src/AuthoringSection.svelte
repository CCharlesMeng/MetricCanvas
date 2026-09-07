<script lang="ts">
  import type { Component, PageSection } from '@metriccanvas/page';
  import { RuntimeSection, sectionGridColumnCount, type ComponentContent } from '@metriccanvas/runtime-ui/composition';
  import type { Attachment } from 'svelte/attachments';
  import { authoringComponentDropIndex, authoringDropSlots, decodeAuthoringComponentLocator } from './authoring-layout';
  import type { AuthoringComponentLocator, AuthoringOptions } from './types';

  let { section, authoring, componentContent }: {
    section: PageSection;
    authoring?: AuthoringOptions;
    componentContent: ComponentContent;
  } = $props();
  let dragged = $state<AuthoringComponentLocator | null>(null);
  let activeDropIndex = $state<number | null>(null);
  const columnCount = $derived(sectionGridColumnCount(section.columnTracks));
  const dropSlots = $derived(authoringDropSlots(section.components.length));

  function attachCell(component: Component, index: number): Attachment<HTMLElement> {
    return (node) => {
      if (!authoring) return;
      node.classList.add('authoring-cell');
      node.classList.toggle('authoring-selected', selected(component.id));
      node.draggable = true;
      const listeners = [
        ['click', (event: MouseEvent) => select(event, component.id), true],
        ['dragstart', (event: DragEvent) => dragStart(event, component.id), false],
        ['dragenter', (event: DragEvent) => dragOverComponent(event, index), false],
        ['dragover', (event: DragEvent) => dragOverComponent(event, index), false],
        ['dragleave', dragLeaveComponent, false],
        ['drop', (event: DragEvent) => dropOnComponent(event, index), false],
        ['dragend', clearDragState, false]
      ] as const;
      for (const [name, listener, capture] of listeners) node.addEventListener(name, listener as EventListener, capture);
      return () => {
        for (const [name, listener, capture] of listeners) node.removeEventListener(name, listener as EventListener, capture);
        node.classList.remove('authoring-cell', 'authoring-selected');
        node.removeAttribute('draggable');
      };
    };
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
      edit: { span: Math.min(columnCount, Math.max(1, component.layout.span + delta)) }
    });
  }
</script>

<svelte:window ondragend={clearDragState} />

<RuntimeSection {section} {componentContent} cellAttachment={attachCell}>
  {#snippet emptyContent()}
    {#if authoring}
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
  {/snippet}
  {#snippet cellOverlay(component: Component, componentIndex: number)}
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
            <span class="authoring-span">{component.layout.span}/{columnCount}</span>
            <button type="button" aria-label="缩小组件" onclick={() => resize(component, -1)}>−</button>
            <button type="button" aria-label="加宽组件" onclick={() => resize(component, 1)}>＋</button>
          </div>
        {/if}
  {/snippet}
</RuntimeSection>
