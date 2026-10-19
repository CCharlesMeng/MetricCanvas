/** Keep a selection's top-layer actions inside its visible scroll region. */
export function observeSelectionActions(target: HTMLElement, actions: HTMLElement): () => void {
  const view = target.ownerDocument.defaultView!;
  let frame = 0;
  let disposed = false;
  const ancestors: HTMLElement[] = [];
  for (let node = target.parentElement; node; node = node.parentElement) ancestors.push(node);

  function update() {
    frame = 0;
    if (disposed || !target.isConnected || !actions.isConnected) return;
    const visible = { left: 0, top: 0, right: view.innerWidth, bottom: view.innerHeight };
    for (const node of ancestors) {
      const style = view.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
        visible.left = Math.max(visible.left, rect.left + node.clientLeft);
        visible.right = Math.min(visible.right, rect.left + node.clientLeft + node.clientWidth);
      }
      if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
        visible.top = Math.max(visible.top, rect.top + node.clientTop);
        visible.bottom = Math.min(visible.bottom, rect.top + node.clientTop + node.clientHeight);
      }
    }
    const cell = target.getBoundingClientRect();
    if (visible.right <= visible.left || visible.bottom <= visible.top ||
      cell.bottom <= visible.top || cell.top >= visible.bottom || cell.right <= visible.left || cell.left >= visible.right) {
      if (actions.matches(':popover-open')) actions.hidePopover();
      return;
    }
    if (!actions.matches(':popover-open')) actions.showPopover();
    actions.style.maxWidth = `${Math.max(0, visible.right - visible.left - 8)}px`;
    const box = actions.getBoundingClientRect();
    const above = cell.top - box.height - 6;
    const preferred = above >= visible.top ? above : cell.bottom + 6;
    const left = Math.max(visible.left + 4, Math.min(cell.right - box.width, visible.right - box.width - 4));
    const top = Math.max(visible.top, Math.min(preferred, visible.bottom - box.height));
    actions.style.left = `${left}px`;
    actions.style.top = `${top}px`;
    actions.style.visibility = 'visible';
  }
  function schedule() {
    if (!disposed && !frame) frame = view.requestAnimationFrame(update);
  }
  const observer = new ResizeObserver(schedule);
  for (const node of [target, actions, ...ancestors]) observer.observe(node);
  view.addEventListener('scroll', schedule, true);
  view.addEventListener('resize', schedule);
  schedule();
  return () => {
    disposed = true;
    observer.disconnect();
    view.removeEventListener('scroll', schedule, true);
    view.removeEventListener('resize', schedule);
    view.cancelAnimationFrame(frame);
    if (actions.isConnected && actions.matches(':popover-open')) actions.hidePopover();
  };
}
