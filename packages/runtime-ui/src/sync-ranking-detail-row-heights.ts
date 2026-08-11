const RANKING_CELL_SELECTOR = ':scope > .ranking-detail-cell';
const RANKING_ROW_SELECTOR = '.ranking-detail-row';
const SAME_ROW_TOLERANCE = 2;

interface RankingCellLayout {
  left: number;
  rows: HTMLElement[];
  top: number;
}

export function syncRankingDetailRowHeights(grid: HTMLElement): void {
  const cells = Array.from(
    grid.querySelectorAll<HTMLElement>(RANKING_CELL_SELECTOR)
  );
  const rows = cells.flatMap((cell) =>
    Array.from(cell.querySelectorAll<HTMLElement>(RANKING_ROW_SELECTOR))
  );

  for (const row of rows) row.style.removeProperty('min-height');
  if (cells.length < 2) return;

  const groups: RankingCellLayout[][] = [];
  for (const element of cells) {
    const rect = element.getBoundingClientRect();
    const layout: RankingCellLayout = {
      left: rect.left,
      rows: Array.from(element.querySelectorAll<HTMLElement>(RANKING_ROW_SELECTOR)),
      top: rect.top
    };
    const group = groups.find(
      (candidate) => Math.abs(candidate[0]!.top - layout.top) <= SAME_ROW_TOLERANCE
    );
    if (group) group.push(layout);
    else groups.push([layout]);
  }

  for (const group of groups) {
    group.sort((left, right) => left.left - right.left);
    if (
      group.length < 2 ||
      Math.abs(group[0]!.left - group[1]!.left) <= SAME_ROW_TOLERANCE
    ) {
      continue;
    }
    const rowCount = Math.max(...group.map((cell) => cell.rows.length));
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const pairedRows = group
        .map((cell) => cell.rows[rowIndex])
        .filter((row): row is HTMLElement => row !== undefined);
      const height = Math.max(
        ...pairedRows.map((row) => row.getBoundingClientRect().height)
      );
      for (const row of pairedRows) row.style.minHeight = `${height}px`;
    }
  }
}

export function installRankingDetailRowHeightSync(grid: HTMLElement): () => void {
  let active = true;
  let animationFrame: number | undefined;
  let observedWidth = grid.getBoundingClientRect().width;

  const schedule = () => {
    if (!active) return;
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      animationFrame = undefined;
      syncRankingDetailRowHeights(grid);
    });
  };
  const resizeObserver = new ResizeObserver(([entry]) => {
    const width = entry?.contentRect.width ?? grid.getBoundingClientRect().width;
    if (Math.abs(width - observedWidth) <= 0.5) return;
    observedWidth = width;
    schedule();
  });
  const mutationObserver = new MutationObserver(schedule);
  const onResize = () => schedule();

  resizeObserver.observe(grid);
  mutationObserver.observe(grid, {
    childList: true,
    characterData: true,
    subtree: true
  });
  window.addEventListener('resize', onResize);
  void document.fonts?.ready.then(schedule);
  schedule();

  return () => {
    active = false;
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener('resize', onResize);
    for (const row of grid.querySelectorAll<HTMLElement>(RANKING_ROW_SELECTOR)) {
      row.style.removeProperty('min-height');
    }
  };
}
