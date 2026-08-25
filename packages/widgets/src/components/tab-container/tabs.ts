export interface TabLabel {
  id: string;
  label: string;
}

export function resolveActiveTab(
  tabs: readonly TabLabel[],
  activeId: string | undefined,
  defaultTab?: string
): string | undefined {
  if (tabs.length === 0) return undefined;
  if (activeId && tabs.some((tab) => tab.id === activeId)) return activeId;
  if (defaultTab && tabs.some((tab) => tab.id === defaultTab)) return defaultTab;
  return tabs[0]?.id;
}
