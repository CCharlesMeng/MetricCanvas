/**
 * 行对齐能力契约:同一视觉行内同类组件的内部行轨等高对齐。
 *
 * 所有权约定:具备能力的纯渲染组件自己测量、自己写回自己的 DOM;
 * 统一运行时只通过本契约协作,并以 `anchor` 判断参与者归属于哪个
 * 布局单元格,从头到尾不触碰组件内部结构。分组、调度与观察者归
 * 统一运行时的行对齐 Module 独占,组件不感知同伴的存在。
 */
export interface RowAlignmentTracks {
  /** 用于归属判定的锚点元素,组件根元素即可。 */
  readonly anchor: HTMLElement;
  /** 返回各对齐轨道当前高度;调用方会先通过 `apply([])` 复原再测量。 */
  measure(): number[];
  /**
   * 把逐轨道最小高度写回组件自身 DOM。
   * `null` 或数组未覆盖的轨道一律复原为自然高度。
   */
  apply(minHeights: ReadonlyArray<number | null>): void;
}

export interface RowAlignmentHandle {
  /** 轨道数量或内容变化(如明细展开)后调用,触发重新对齐。 */
  changed(): void;
  /** 组件卸载时调用;已写入的最小高度会被复原。 */
  release(): void;
}

const participants = new Set<RowAlignmentTracks>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function publishRowAlignment(tracks: RowAlignmentTracks): RowAlignmentHandle {
  participants.add(tracks);
  notify();
  return {
    changed: notify,
    release: () => {
      if (!participants.delete(tracks)) return;
      tracks.apply([]);
      notify();
    }
  };
}

export function rowAlignmentParticipants(): readonly RowAlignmentTracks[] {
  return [...participants];
}

/** 订阅参与者集合或轨道内容的变化;返回取消订阅函数。 */
export function subscribeRowAlignment(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
