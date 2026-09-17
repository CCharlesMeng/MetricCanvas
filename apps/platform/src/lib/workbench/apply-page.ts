/** Apply supplied metadata directly, or request a fresh provider read by pageId. */
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
  onpreview(previewJson: unknown): void | Promise<void>;
  onerror(message: string): void;
  captureIdentity(): string;
}): () => void {
  const identity = options.captureIdentity();
  let disposed = false;
  const listener = (event: Event) => {
    if (disposed || identity !== options.captureIdentity()) return;
    const detail = (event as CustomEvent<unknown>).detail;
    const hasPreview = !!detail && typeof detail === 'object' && !Array.isArray(detail) &&
      Object.prototype.hasOwnProperty.call(detail, 'previewJson');
    const id = hasPreview ? null : pageIdOf(detail);
    if (!hasPreview && !id) { options.onerror('应用通知无效：需要 previewJson 或非空的 pageId。'); return; }
    void Promise.resolve().then(() => {
      if (!disposed && identity === options.captureIdentity()) {
        if (hasPreview) return options.onpreview((detail as Record<string, unknown>).previewJson);
        return options.onapply(id!);
      }
    }).catch((error: unknown) => {
      if (!disposed && identity === options.captureIdentity()) options.onerror(error instanceof Error ? error.message : String(error));
    });
  };
  options.target.addEventListener(APPLY_PAGE_EVENT, listener);
  return () => { disposed = true; options.target.removeEventListener(APPLY_PAGE_EVENT, listener); };
}
