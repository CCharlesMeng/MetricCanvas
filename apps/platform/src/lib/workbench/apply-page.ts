/** Card confirmation requests a fresh provider read, not an exact saved artifact. */
export const APPLY_PAGE_EVENT = 'metriccanvas:apply-page';
export function pageIdOf(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  const value = detail as Record<string, unknown>;
  const id = value.pageId;
  return Object.keys(value).length === 1 && typeof id === 'string' && id.length > 0 &&
    id.length <= 512 && id.trim() === id && !/[\x00-\x1f\x7f]/.test(id) ? id : null;
}
export function listenForApplyPage(options: {
  target: EventTarget;
  onapply(pageId: string): Promise<void>;
  onerror(message: string): void;
  captureIdentity(): string;
}): () => void {
  const identity = options.captureIdentity();
  let disposed = false;
  const listener = (event: Event) => {
    if (disposed || identity !== options.captureIdentity()) return;
    const id = pageIdOf((event as CustomEvent<unknown>).detail);
    if (!id) { options.onerror('应用通知无效：只接受非空的 pageId。'); return; }
    void Promise.resolve().then(() => {
      if (!disposed && identity === options.captureIdentity()) return options.onapply(id);
    }).catch((error: unknown) => {
      if (!disposed && identity === options.captureIdentity()) options.onerror(error instanceof Error ? error.message : String(error));
    });
  };
  options.target.addEventListener(APPLY_PAGE_EVENT, listener);
  return () => { disposed = true; options.target.removeEventListener(APPLY_PAGE_EVENT, listener); };
}
