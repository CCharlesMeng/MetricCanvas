import { pageComponentTypes, pageLayouts, pageDataKinds } from './page-directory';

/** 开发工具目录状态，与运行页面的筛选状态和 URL 参数分开保存。 */
export interface DirectoryNavigationState {
  query: string;
  layoutForm: string;
  component: string;
  dataKind: string;
  folder: string;
  scrollY: number;
}

const STORAGE_KEY = 'metriccanvas:page-directory:v1';
let memory: DirectoryNavigationState | undefined;

export function normalizeDirectoryNavigationState(value: unknown): DirectoryNavigationState {
  const state = (value && typeof value === 'object' ? value : {}) as Partial<DirectoryNavigationState>;
  const selection = (value: unknown, items: readonly { id: string }[]) =>
    typeof value === 'string' && items.some((item) => item.id === value) ? value : 'all';
  return {
    query: typeof state.query === 'string' ? state.query : '',
    layoutForm: selection(state.layoutForm, pageLayouts),
    component: selection(state.component, pageComponentTypes),
    dataKind: selection(state.dataKind, pageDataKinds),
    folder: typeof state.folder === 'string' && (state.folder === '.' || state.folder.split('/').every(part => part && part !== '.' && part !== '..' && !/[\\\0]/.test(part))) ? state.folder : 'all',
    scrollY: typeof state.scrollY === 'number' && Number.isFinite(state.scrollY) ? Math.max(0, state.scrollY) : 0
  };
}

export function readDirectoryNavigationState(): DirectoryNavigationState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return normalizeDirectoryNavigationState(raw ? JSON.parse(raw) : memory);
  } catch {
    return normalizeDirectoryNavigationState(memory);
  }
}

export function rememberDirectoryNavigationState(state: DirectoryNavigationState): void {
  memory = normalizeDirectoryNavigationState(state);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // 存储被禁用或配额不足时，同一应用会话仍可返回目录。
  }
}
