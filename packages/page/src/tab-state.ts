import { flattenPageComponents } from './component-walk';
import type { Component, Page, TabContainerComponent, TabContentComponent } from './page';

export type TabSelections = Readonly<Record<string, string>>;
export function tabChildren(tab: TabContainerComponent['props']['tabs'][number]): TabContentComponent[] {
  return 'components' in tab ? tab.components : [tab.component];
}
export function selectedTab(component: TabContainerComponent, selections: TabSelections = {}): string {
  const { tabs, defaultTab } = component.props;
  const selected = selections[component.id];
  return tabs.find(tab => tab.id === selected)?.id ?? tabs.find(tab => tab.id === defaultTab)?.id ?? tabs[0]!.id;
}
export function initialTabSelections(page: Page, search = ''): Record<string, string> {
  const params = new URLSearchParams(search);
  return Object.fromEntries(flattenPageComponents(page).flatMap(component => component.type === 'tabContainer'
    ? [[component.id, selectedTab(component, { [component.id]: params.get(`tab.${component.id}`) ?? '' })]] : []));
}
export function tabSearch(search: string, selections: TabSelections): string {
  const params = new URLSearchParams(search);
  for (const [id, value] of Object.entries(selections)) params.set(`tab.${id}`, value);
  return params.toString();
}
/** Presentation demand only; full tree traversal remains available for export/validation. */
export function activePageComponents(page: Page, selections: TabSelections = {}): Component[] {
  const result: Component[] = [];
  function visit(component: Component) {
    result.push(component);
    if (component.type === 'tabContainer') {
      const tab = component.props.tabs.find(tab => tab.id === selectedTab(component, selections))!;
      tabChildren(tab).forEach(visit);
    } else if (component.type === 'compositeCard') component.props.components.forEach(visit);
  }
  page.sections.forEach(section => section.components.forEach(visit));
  page.detailViews?.filter(view => view.mode === 'snapshot').forEach(view => view.components.forEach(visit));
  return result;
}
