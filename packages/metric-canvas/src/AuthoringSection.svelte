<script lang="ts">
  import type { Component, PageSection } from '@metriccanvas/page/internal';
  import { RuntimeSection, sectionGridColumnCount, type ComponentContent } from '@metriccanvas/engine/ui/composition';
  import CanvasSelectionActions from './CanvasSelectionActions.svelte';
  import type { Attachment } from 'svelte/attachments';
  import { authoringComponentDropIndex, authoringDropSlots, normalizeAuthoringDropTarget } from './authoring-layout';
  import type { AuthoringComponentLocator, AuthoringOptions } from './types';

  let { section, authoring, componentContent, dragSource, onDragSourceChange }: {
    section: PageSection;
    authoring?: AuthoringOptions;
    componentContent: ComponentContent;
    dragSource: AuthoringComponentLocator | null;
    onDragSourceChange: (source: AuthoringComponentLocator | null) => void;
  } = $props();
  let activeDropIndex = $state<number | null>(null);
  $effect(() => { if (!dragSource) activeDropIndex = null; });
  let selectionRegistration = 0;
  let selectionCell = $state<HTMLElement | null>(null);
  const selectedIndex = $derived(section.components.findIndex(component => selected(component.id)));
  const selectedComponent = $derived(section.components[selectedIndex]);
  const contextualActions = $derived(authoring !== undefined && authoring.inlineControls === false);
  const columnCount = $derived(sectionGridColumnCount(section.columnTracks));
  const dropSlots = $derived(authoringDropSlots(section.components.length));

  function attachCell(component: Component, index: number): Attachment<HTMLElement> {
    return (node) => {
      if (!authoring) return;
      const registration = selected(component.id) ? ++selectionRegistration : 0;
      if (registration) selectionCell = node;
      node.classList.add('authoring-cell');
      node.classList.toggle('authoring-selected', selected(component.id));
      node.classList.toggle('authoring-dragging', dragSource?.componentId === component.id);
      const measure = () => node.classList.toggle('authoring-full-row', isFullRow(node));
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      node.tabIndex = 0;
      node.setAttribute('aria-label', `组件：${typeof component.props.title === 'string' ? component.props.title : component.id}`);
      const listeners = [
        ['click', (event: MouseEvent) => select(event, component.id), true],
        ['dragstart', (event: DragEvent) => { if (!(event.target instanceof Element) || !event.target.closest('.authoring-drag-handle')) event.preventDefault(); }, false],
        ['keydown', (event: KeyboardEvent) => {
          if (event.target !== node) return;
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); authoring?.onintent({ type: 'select_component', locator: locator(component.id) }); }
          if (event.key === 'Delete' && selected(component.id) && authoring?.allowDelete) { event.preventDefault(); remove(component); }
        }, false],
        ['dragenter', (event: DragEvent) => dragOverComponent(event, index), false],
        ['dragover', (event: DragEvent) => dragOverComponent(event, index), false],
        ['dragleave', dragLeaveComponent, false],
        ['drop', (event: DragEvent) => dropOnComponent(event, index), false],
        ['dragend', clearDragState, false]
      ] as const;
      for (const [name, listener, capture] of listeners) node.addEventListener(name, listener as EventListener, capture);
      return () => {
        if (registration && registration === selectionRegistration && selectionCell === node) selectionCell = null;
        for (const [name, listener, capture] of listeners) node.removeEventListener(name, listener as EventListener, capture);
        observer.disconnect();
        node.classList.remove('authoring-cell', 'authoring-selected', 'authoring-dragging', 'authoring-full-row');
        node.removeAttribute('tabindex');
        node.removeAttribute('aria-label');
        node.removeAttribute('draggable');
      };
    };
  }

  function isFullRow(node: HTMLElement): boolean {
    const grid = node.parentElement;
    if (!grid) return false;
    const style = getComputedStyle(grid);
    const contentWidth = grid.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return node.getBoundingClientRect().width >= contentWidth - 2;
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
    if (!authoring || (event.target as HTMLElement).closest('.authoring-controls, .authoring-toolbar, .selection-actions')) return;
    event.preventDefault();
    event.stopPropagation();
    authoring.onintent({
      type: 'select_component',
      locator: locator(componentId)
    });
  }

  function dragStart(event: DragEvent, componentId: string) {
    if (!authoring) return;
    event.stopPropagation();
    const source = locator(componentId);
    onDragSourceChange(source);
    event.dataTransfer?.setData(
      'application/x-metriccanvas-component',
      JSON.stringify(source)
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dragOverSlot(event: DragEvent, index: number) {
    if (!authoring || !dragSource) return;
    event.preventDefault();
    event.stopPropagation();
    const sourceIndex = section.components.findIndex(component => component.id === dragSource.componentId);
    if (normalizeAuthoringDropTarget({ sectionId: dragSource.sectionId, index: sourceIndex }, { sectionId: section.id, index }, section.components.length).kind !== 'move') {
      activeDropIndex = null;
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      return;
    }
    scrollNearEdge(event);
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    activeDropIndex = index;
  }

  function componentDropIndex(event: DragEvent, componentIndex: number): number {
    const element = event.currentTarget as HTMLElement;
    const bounds = element.getBoundingClientRect();
    const vertical = isFullRow(element);
    return authoringComponentDropIndex(componentIndex,
      vertical ? event.clientY : event.clientX,
      vertical ? bounds.top : bounds.left,
      vertical ? bounds.height : bounds.width);

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
    const source = dragSource;
    const sourceIndex = section.components.findIndex(component => component.id === source?.componentId);
    if (source && normalizeAuthoringDropTarget(
      { sectionId: source.sectionId, index: sourceIndex },
      { sectionId: section.id, index }, section.components.length
    ).kind === 'move') {
      authoring.onintent({
        type: 'move_component',
        locator: source,
        destination: { sectionId: section.id, index }
      });
    }
    clearDragState();
  }

  function clearDragState() {
    onDragSourceChange(null);
    activeDropIndex = null;
  }

  function moveSelected(delta: number) {
    if (!authoring || !selectedComponent || selectedIndex + delta < 0 || selectedIndex + delta >= section.components.length) return;
    authoring.onintent({ type: 'move_component', locator: locator(selectedComponent.id),
      destination: { sectionId: section.id, index: selectedIndex + (delta > 0 ? 2 : -1) } });
  }

  function remove(component: Component) {
    if (authoring?.allowDelete) authoring.onintent({ type: 'delete_component', locator: locator(component.id) });
  }

  function scrollNearEdge(event: DragEvent) {
    let node = event.currentTarget instanceof HTMLElement ? event.currentTarget.parentElement : null;
    while (node) {
      if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY)) {
        const bounds = node.getBoundingClientRect();
        if (event.clientY < bounds.top + 56) node.scrollTop -= 18;
        else if (event.clientY > bounds.bottom - 56) node.scrollTop += 18;
        return;
      }
      node = node.parentElement;
    }
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
      >拖动组件到此分区</div>
    {/if}
  {/snippet}
  {#snippet cellOverlay(component: Component, componentIndex: number)}
        {#if authoring}
          <div class="authoring-toolbar">
            <button type="button" class="authoring-drag-handle" draggable="true" aria-label={`拖动组件 ${component.id}`} title="拖动调整位置" ondragstart={event => dragStart(event, component.id)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></svg>
            </button>
            {#if authoring.allowDelete && !contextualActions}
              <button type="button" class="authoring-delete" aria-label={`删除组件 ${component.id}`} title="删除组件（可撤销）" onclick={() => remove(component)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 4h12M6 4V2h4v2M4 4l.7 10h6.6L12 4M6.5 6v5M9.5 6v5"/></svg>
              </button>
            {/if}
          </div>
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

{#if authoring && contextualActions && selectedComponent}
  <CanvasSelectionActions target={selectionCell}
    title={typeof selectedComponent.props.title === 'string' ? selectedComponent.props.title : selectedComponent.id}
    componentId={selectedComponent.id} index={selectedIndex} count={section.components.length}
    allowDelete={authoring.allowDelete} onmove={moveSelected} ondelete={() => remove(selectedComponent)} />
{/if}
