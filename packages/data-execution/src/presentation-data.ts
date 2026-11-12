import type { Component } from '@metriccanvas/page/internal';

/** Keep references outside the hidden column/series too: labels, actions and bindings. */
function referencedSlots(value: unknown, slots: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(item => referencedSlots(item, slots));
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.data === 'string' && typeof record.field === 'string') slots.add(record.data);
  Object.values(record).forEach(item => referencedSlots(item, slots));
}

/** Prune only component slots, never the declared query or its result contract. */
export function projectPresentationData<T extends Component>(component: T, enabled: boolean): T {
  if (!enabled || !component.data) return component;
  const slots = new Set<string>();
  const emptyTable = component.type === 'table' && component.props.columns.length === 0;
  if (!emptyTable) {
    // Main owns the row/category domain, including constant chart series.
    slots.add('main');
    referencedSlots(component.props, slots);
    if (component.type === 'table' && component.props.pinnedTop) {
      slots.add(component.props.pinnedTop.data);
      component.props.pinnedTop.additionalData?.forEach(slot => slots.add(slot));
    }
  }
  return { ...component, data: Object.fromEntries(Object.entries(component.data).filter(([slot]) => slots.has(slot))) };
}
