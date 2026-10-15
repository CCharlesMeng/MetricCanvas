/** Keep header filters in their DOM root while escaping the table's scroll clip. */
export function tableFilterPopover(details: HTMLDetailsElement) {
  const panel = details.querySelector<HTMLElement>('.menu')!;
  const anchor = details.querySelector<HTMLElement>('summary')!;
  const doc = details.ownerDocument;
  const win = doc.defaultView!;
  let stop: (() => void) | undefined;

  function position() {
    const viewport = win.visualViewport;
    const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? win.innerWidth, height = viewport?.height ?? win.innerHeight;
    const rect = anchor.getBoundingClientRect(), size = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(x + 8, Math.min(rect.left, x + width - size.width - 8))}px`;
    panel.style.top = `${rect.bottom + 4 + size.height <= y + height - 8
      ? rect.bottom + 4 : Math.max(y + 8, rect.top - size.height - 4)}px`;
    if (rect.bottom < y || rect.top > y + height || rect.right < x || rect.left > x + width) details.open = false;
  }
  function sync() {
    stop?.(); stop = undefined;
    if (!details.open) {
      if (panel.matches(':popover-open')) panel.hidePopover();
      return;
    }
    panel.showPopover();
    position();
    doc.addEventListener('scroll', position, true);
    win.addEventListener('resize', position);
    win.visualViewport?.addEventListener('resize', position);
    win.visualViewport?.addEventListener('scroll', position);
    const observer = new ResizeObserver(position);
    observer.observe(anchor); observer.observe(panel);
    stop = () => {
      doc.removeEventListener('scroll', position, true);
      win.removeEventListener('resize', position);
      win.visualViewport?.removeEventListener('resize', position);
      win.visualViewport?.removeEventListener('scroll', position);
      observer.disconnect();
    };
  }
  function closed(event: ToggleEvent) {
    if (event.newState === 'closed') details.open = false;
  }
  details.addEventListener('toggle', sync);
  panel.addEventListener('toggle', closed);
  return { destroy() {
    details.removeEventListener('toggle', sync);
    panel.removeEventListener('toggle', closed);
    stop?.();
    if (panel.matches(':popover-open')) panel.hidePopover();
  } };
}
