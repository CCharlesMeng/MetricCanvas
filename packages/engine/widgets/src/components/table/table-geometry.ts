/** Presentation-only geometry. Query/view state remains owned by the runtime. */
export function tableGeometry(root: HTMLElement, enabled: boolean) {
  let dispose: (() => void) | undefined;

  function start(active: boolean) {
    dispose?.();
    dispose = undefined;
    if (!active) return;
    const targetTable = root.querySelector('table');
    const targetScroll = root.querySelector<HTMLElement>('.scroll');
    if(!targetTable || !targetScroll)return;
    const table=targetTable,scroll=targetScroll;
    const win = root.ownerDocument.defaultView!;
    let frame = 0;
    const observed = new Set<Element>();
    const resize = new ResizeObserver(schedule);

    function measure() {
      frame = 0;
      root.style.setProperty('--table-viewport-width', `${scroll.clientWidth}px`);
      let top = 0;
      const rows = table.querySelectorAll<HTMLTableRowElement>(':scope > thead > tr');
      for (const row of rows) {
        row.style.setProperty('--table-header-top', `${top}px`);
        top += row.getBoundingClientRect().height;
      }
      const widths = Array.from(table.querySelectorAll(':scope > colgroup > col'), col => col.getBoundingClientRect().width);
      const headers = Array.from(table.querySelectorAll<HTMLElement>(':scope > thead > tr > th.fixed'));
      const offsets = new Map<number, { side: 'left' | 'right'; offset: number; boundary: boolean }>();
      for (const side of ['left', 'right'] as const) {
        const indexes = headers.filter(cell => cell.style[side] !== '')
          .map(cell => Number(cell.dataset.columnIndex)).sort((a, b) => a - b);
        if (side === 'right') indexes.reverse();
        let offset = 0;
        for (const [position, index] of indexes.entries()) {
          offsets.set(index, { side, offset, boundary: position === indexes.length - 1 });
          offset += widths[index] ?? 0;
        }
      }
      for (const cell of table.querySelectorAll<HTMLElement>(':scope > :is(thead,tbody) > tr > .fixed[data-column-index]')) {
        const fixed = offsets.get(Number(cell.dataset.columnIndex));
        if (!fixed) continue;
        cell.style.setProperty(`--table-sticky-${fixed.side}`, `${fixed.offset}px`);
        cell.classList.toggle('fixed-left-boundary', fixed.side === 'left' && fixed.boundary);
        cell.classList.toggle('fixed-right-boundary', fixed.side === 'right' && fixed.boundary);
      }
      // A narrow viewport cannot contain both pinned banks. Keep every column
      // reachable with ordinary inner scrolling until there is room to pin them.
      const pinnedWidth = [...offsets.keys()].reduce((total, index) => total + (widths[index] ?? 0), 0);
      root.classList.toggle('fixed-overflow', pinnedWidth >= scroll.clientWidth && pinnedWidth > 0);
      root.classList.toggle('scrolled-left', scroll.scrollLeft > 1);
      root.classList.toggle('scrolled-right', scroll.scrollLeft + scroll.clientWidth < scroll.scrollWidth - 1);
      const targets = new Set<Element>([root, table, ...rows, ...table.querySelectorAll(':scope > thead > tr > th')]);
      for (const element of observed) if (!targets.has(element)) { resize.unobserve(element); observed.delete(element); }
      for (const element of targets) if (!observed.has(element)) { resize.observe(element); observed.add(element); }
    }
    function schedule() { if (!frame) frame = win.requestAnimationFrame(measure); }
    const mutation = new MutationObserver(schedule);
    mutation.observe(table, { childList: true, characterData: true, subtree: true });
    scroll.addEventListener('scroll', schedule, { passive: true });
    schedule();
    dispose = () => {
      resize.disconnect();
      mutation.disconnect();
      scroll.removeEventListener('scroll', schedule);
      if (frame) win.cancelAnimationFrame(frame);
      root.classList.remove('scrolled-left', 'scrolled-right', 'fixed-overflow');
      root.style.removeProperty('--table-viewport-width');
      for (const cell of table.querySelectorAll<HTMLElement>(':scope > :is(thead,tbody) > tr > .fixed[data-column-index]')) {
        cell.style.removeProperty('--table-sticky-left');
        cell.style.removeProperty('--table-sticky-right');
        cell.classList.remove('fixed-left-boundary', 'fixed-right-boundary');
      }
      for (const row of rowsOf(table)) row.style.removeProperty('--table-header-top');
    };
  }
  start(enabled);
  return { update: start, destroy: () => dispose?.() };
}

function rowsOf(table: Element) {
  return table.querySelectorAll<HTMLElement>(':scope > thead > tr');
}
