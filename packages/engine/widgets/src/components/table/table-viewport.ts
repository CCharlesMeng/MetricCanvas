/** The visible body is capped at twelve data rows; headers and summary are extra. */
export function measureTableViewport(root: HTMLElement, table: HTMLTableElement, scroll: HTMLElement): Element[] {
  const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>(
    ':scope > tbody > tr:not(.row-expansion-row):not([data-pinned-top])'
  ));
  const rows = bodyRows.slice(0, 12);
  const fixedRows = Array.from(table.querySelectorAll<HTMLElement>(':scope > thead, :scope > tbody > tr[data-pinned-top]'));
  if (bodyRows.length <= 12 && !table.querySelector(':scope > tbody > .row-expansion-row')) {
    root.style.removeProperty('--table-viewport-max-height');
    return [...fixedRows, ...rows];
  }
  const height = [...fixedRows, ...rows].reduce((total, row) => total + row.getBoundingClientRect().height, 0);
  // Include borders and a native horizontal scrollbar without sacrificing the twelfth row.
  const chrome = scroll.offsetHeight - scroll.clientHeight;
  root.style.setProperty('--table-viewport-max-height', `${height + chrome}px`);
  return [...fixedRows, ...rows];
}

export function reconcileResizeTargets(observer: ResizeObserver, observed: Set<Element>, targets: Set<Element>): void {
  for (const element of observed) {
    if (targets.has(element)) continue;
    observer.unobserve(element);
    observed.delete(element);
  }
  for (const element of targets) {
    if (observed.has(element)) continue;
    observer.observe(element);
    observed.add(element);
  }
}
