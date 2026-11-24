export interface ExpandedTableRow {
  cell: HTMLElement;
  peers: HTMLElement[];
}

export function tableExpandCell(grid: HTMLElement | null, anchor: HTMLElement): HTMLElement | undefined {
  const cell = anchor.closest<HTMLElement>('[data-component-type="table"]');
  return grid && cell?.parentElement === grid ? cell : undefined;
}

export function expandTableRow(cell: HTMLElement): ExpandedTableRow {
  const top = cell.getBoundingClientRect().top;
  const peers = Array.from(cell.parentElement!.children).filter((item): item is HTMLElement =>
    item instanceof HTMLElement && item !== cell && !item.classList.contains('backdrop-cell') &&
    item.getClientRects().length > 0 &&
    Math.abs(item.getBoundingClientRect().top - top) <= 2
  );
  cell.setAttribute('data-table-expanded', '');
  for (const peer of peers) peer.setAttribute('data-table-expansion-peer', '');
  return { cell, peers };
}

export function restoreTableRow({ cell, peers }: ExpandedTableRow): void {
  cell.removeAttribute('data-table-expanded');
  for (const peer of peers) peer.removeAttribute('data-table-expansion-peer');
}
