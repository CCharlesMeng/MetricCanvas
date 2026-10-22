import { catalogCapabilities, catalogCategories, catalogLayouts, catalogRuntimes } from './page-catalog';

/** 开发工具目录状态，与运行页面的筛选状态和 URL 参数分开保存。 */
export interface CatalogNavigationState {
  query: string;
  category: string;
  layoutForm: string;
  capability: string;
  runtime: string;
  scrollY: number;
}

const STORAGE_KEY = 'metriccanvas:catalog-navigation:v1';
let memory: CatalogNavigationState | undefined;

export function normalizeCatalogNavigationState(value: unknown): CatalogNavigationState {
  const state = (value && typeof value === 'object' ? value : {}) as Partial<CatalogNavigationState>;
  const selection = (value: unknown, items: readonly { id: string }[]) =>
    typeof value === 'string' && items.some((item) => item.id === value) ? value : 'all';
  return {
    query: typeof state.query === 'string' ? state.query : '',
    category: selection(state.category, catalogCategories),
    layoutForm: selection(state.layoutForm, catalogLayouts),
    capability: selection(state.capability, catalogCapabilities),
    runtime: selection(state.runtime, catalogRuntimes),
    scrollY: typeof state.scrollY === 'number' && Number.isFinite(state.scrollY) ? Math.max(0, state.scrollY) : 0
  };
}

export function readCatalogNavigationState(): CatalogNavigationState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return normalizeCatalogNavigationState(raw ? JSON.parse(raw) : memory);
  } catch {
    return normalizeCatalogNavigationState(memory);
  }
}

export function rememberCatalogNavigationState(state: CatalogNavigationState): void {
  memory = normalizeCatalogNavigationState(state);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // 存储被禁用或配额不足时，同一应用会话仍可返回目录。
  }
}
