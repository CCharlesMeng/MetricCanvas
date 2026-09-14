import type { DialogueAdapter } from './port';

/** 容器内部生命周期：卸载早于异步 mount 完成时，仍须释放迟到的挂载。 */
export function attachDialogue(
  adapter: DialogueAdapter,
  element: HTMLElement,
  onError: (cause: unknown) => void
): () => void {
  let disposed = false;
  let destroy: (() => void) | undefined;
  void (async () => {
    try {
      const cleanup = await adapter.mount(element);
      if (disposed) cleanup();
      else destroy = cleanup;
    } catch (cause) {
      if (!disposed) onError(cause);
    }
  })();
  return () => {
    if (disposed) return;
    disposed = true;
    destroy?.();
  };
}
