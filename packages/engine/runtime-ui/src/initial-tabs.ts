import { walkPageComponents, type Page } from '@metriccanvas/page/internal';

/** 页面实例初始化时读取显式 URL 输入；只交付合法页签，缺省回退由 Tab 组件负责。 */
export function initialTabsFromSearch(page: Page, search: string): ReadonlyMap<string, string> {
  const query = new URLSearchParams(search);
  const initialTabs = new Map<string, string>();
  walkPageComponents(page, component => {
    if (component.type !== 'tabContainer' || !component.props.initialTabUrlParam) return;
    const values = query.getAll(component.props.initialTabUrlParam);
    if (values.length === 1 && component.props.tabs.some(tab => tab.id === values[0])) {
      initialTabs.set(component.id, values[0]!);
    }
  });
  return initialTabs;
}
