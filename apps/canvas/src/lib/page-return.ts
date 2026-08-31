/**
 * Canvas 参考宿主的回跳记录(ADR-0048)。
 * 运行时只上抛 sourcePageId / sourceSearch,宿主自己记来源、自己执行返回。
 * 深链接没有来源时返回 undefined,由宿主隐藏回退入口。
 */
export interface PageReturnTarget {
  pageId: string;
  search: string;
}

const STORAGE_PREFIX = 'metriccanvas:return:';
const memory = new Map<string, string>();

function storage(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
} {
  if (typeof sessionStorage !== 'undefined') return sessionStorage;
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    }
  };
}

export function rememberPageReturn(
  pageId: string,
  source: { pageId?: string; search?: string }
): void {
  if (!source.pageId) return;
  storage().setItem(
    `${STORAGE_PREFIX}${pageId}`,
    JSON.stringify({ pageId: source.pageId, search: source.search ?? '' })
  );
}

export function clearPageReturns(): void {
  memory.clear();
}

export function pageReturnOf(pageId: string): PageReturnTarget | undefined {
  try {
    const raw = storage().getItem(`${STORAGE_PREFIX}${pageId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { pageId?: unknown; search?: unknown };
    if (typeof parsed.pageId !== 'string' || parsed.pageId.length === 0) return undefined;
    return {
      pageId: parsed.pageId,
      search: typeof parsed.search === 'string' ? parsed.search : ''
    };
  } catch {
    return undefined;
  }
}

export function pageHref(pageId: string, search = ''): string {
  return `/pages/${pageId}${search ? `?${search}` : ''}`;
}

/** 深链缺少真实来源时缺席，宿主不得使用无关浏览器历史伪造返回。 */
export function pageReturnHref(pageId: string): string | undefined {
  const target = pageReturnOf(pageId);
  return target ? pageHref(target.pageId, target.search) : undefined;
}
