/** Wait for actual visibility and a completed paint before allowing idle prefetch. */
export function visibleAfterPaint(node: HTMLElement, notify?: (visible: boolean) => void) {
  let callback = notify, visible = false, disposed = false;
  let frame: number | undefined;
  let observer: IntersectionObserver | undefined;
  function cancelFrame() { if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; }
  function visibility(next: boolean) {
    if (next === visible || disposed || !callback) return;
    visible = next;
    cancelFrame();
    if (!next) { callback?.(false); return; }
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (visible && !disposed) callback?.(true);
      });
    });
  }
  function connect() {
    if (observer || !callback) return;
    observer = new IntersectionObserver(entries => visibility(entries.some(entry => entry.isIntersecting)));
    observer.observe(node);
  }
  connect();
  return {
    update(next?: (visible: boolean) => void) {
      if (callback === next) return;
      callback?.(false); callback = next;
      cancelFrame();
      observer?.disconnect(); observer = undefined; visible = false;
      connect();
    },
    destroy() { disposed = true; cancelFrame(); observer?.disconnect(); callback?.(false); }
  };
}
