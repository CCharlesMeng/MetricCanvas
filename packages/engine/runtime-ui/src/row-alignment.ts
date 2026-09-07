import {
  rowAlignmentParticipants,
  subscribeRowAlignment,
  type RowAlignmentTracks
} from '@metriccanvas/widgets';

/**
 * 通用行对齐深 Module(统一运行时不变量,不进入页面 JSON):
 * 同一父 Grid、同一视觉行内,组件类型与 `props.variant` 都相同、
 * 且发布了行对齐能力的 ≥2 个组件,内部行轨按序号取最大自然高度对齐。
 * 响应式堆叠成单列后自动复原;单参与者不做任何事。
 *
 * 分组只依赖本 Module 自己拥有的单元格元素(`.cell` 的几何与
 * `data-component-*` 标注);测量与写回都经由 `RowAlignmentTracks`
 * 契约由组件对自己的 DOM 完成,这里不出现任何组件内部选择器。
 */

const SAME_ROW_TOLERANCE = 2;

interface Entry {
  cell: HTMLElement;
  key: string;
  left: number;
  top: number;
  tracks: RowAlignmentTracks;
}

export function alignRowTracks(grid: HTMLElement): void {
  const cells = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .cell'));
  const engaged = rowAlignmentParticipants().flatMap((tracks) => {
    const cell = cells.find((candidate) => candidate.contains(tracks.anchor));
    return cell ? [{ cell, tracks }] : [];
  });

  for (const { tracks } of engaged) tracks.apply([]);
  if (engaged.length < 2) return;

  const entries: Entry[] = engaged.map(({ cell, tracks }) => {
    const rect = cell.getBoundingClientRect();
    return {
      cell,
      key: `${cell.dataset.componentType ?? ''}\u0000${cell.dataset.componentVariant ?? ''}`,
      left: rect.left,
      top: rect.top,
      tracks
    };
  });

  const groups: Entry[][] = [];
  for (const entry of entries) {
    const group = groups.find(
      (candidate) =>
        candidate[0]!.key === entry.key &&
        Math.abs(candidate[0]!.top - entry.top) <= SAME_ROW_TOLERANCE
    );
    if (group) group.push(entry);
    else groups.push([entry]);
  }

  for (const group of groups) {
    group.sort((left, right) => left.left - right.left);
    const stacked =
      group.length >= 2 &&
      Math.abs(group[0]!.left - group[1]!.left) <= SAME_ROW_TOLERANCE;
    if (group.length < 2 || stacked) continue;

    const naturalHeights = group.map((entry) => entry.tracks.measure());
    const trackCount = Math.max(...naturalHeights.map((heights) => heights.length));
    const targets: number[] = [];
    for (let index = 0; index < trackCount; index += 1) {
      targets.push(
        Math.max(
          ...naturalHeights.map((heights) => heights[index] ?? Number.NEGATIVE_INFINITY)
        )
      );
    }
    for (const [participantIndex, entry] of group.entries()) {
      entry.tracks.apply(
        naturalHeights[participantIndex]!.map((_, index) => targets[index] ?? null)
      );
    }
  }
}

export function installRowAlignment(grid: HTMLElement): () => void {
  let active = true;
  let animationFrame: number | undefined;
  let observedWidth = grid.getBoundingClientRect().width;

  const schedule = () => {
    if (!active) return;
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      animationFrame = undefined;
      alignRowTracks(grid);
    });
  };
  const resizeObserver = new ResizeObserver(([entry]) => {
    const width = entry?.contentRect.width ?? grid.getBoundingClientRect().width;
    if (Math.abs(width - observedWidth) <= 0.5) return;
    observedWidth = width;
    schedule();
  });
  // 只观察 Grid 自己的直接子节点(创作态拖拽重排),不观察组件子树。
  const mutationObserver = new MutationObserver(schedule);
  const onResize = () => schedule();
  const unsubscribe = subscribeRowAlignment(schedule);

  resizeObserver.observe(grid);
  mutationObserver.observe(grid, { childList: true });
  window.addEventListener('resize', onResize);
  void document.fonts?.ready.then(schedule);
  schedule();

  return () => {
    active = false;
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener('resize', onResize);
    unsubscribe();
    for (const tracks of rowAlignmentParticipants()) {
      if (grid.contains(tracks.anchor)) tracks.apply([]);
    }
  };
}
