import type { TabSelections } from '@metriccanvas/page/internal';
export const TAB_SELECTION_CONTEXT = Symbol('metriccanvas.tabSelection');
export interface TabSelectionContext {
  selections(): TabSelections;
  select(componentId: string, tabId: string): void;
}
