/**
 * 叠放分区的未遮挡矩形(统一运行时不变量,不进入页面 JSON)。
 *
 * 分区把 backdrop 单元格铺在底层、浮层单元格叠在其上之后,backdrop 里的内容
 * (地图)只有落在「没有被任何浮层压住」的那块矩形里才是可见可点的。本模块把
 * 这块矩形算出来,交给 `RuntimeSection` 以 CSS 自定义属性下发给 backdrop 单元格。
 *
 * 零 DOM 依赖、零框架导入:`PATTERN-TEST-1` 规定本仓 vitest 不渲染组件,
 * 组件行为必须先抽成纯函数才可测,所以几何计算不能留在 `.svelte` 里。
 */

export interface SafeAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const bounds = (rect: SafeAreaRect): Bounds => ({
  left: rect.x,
  top: rect.y,
  right: rect.x + rect.width,
  bottom: rect.y + rect.height
});

const overlaps = (a: Bounds, b: Bounds): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** 去重并升序;候选边界只有个位数,排序成本可忽略。 */
const sortedUnique = (values: number[]): number[] =>
  [...new Set(values)].sort((left, right) => left - right);

/**
 * backdrop 与浮层并集的差集里,面积最大的那个轴对齐矩形。
 *
 * 入参与返回值同处一个坐标系——调用方须先把浮层矩形归一到 backdrop 所在的
 * 坐标系(见 IFC:overlay 坐标已归一到 backdrop 局部坐标系)。无解返回 `null`,
 * 消费方据此退回全容器渲染。
 *
 * 判据取「候选边界网格上的最大空矩形」:最优解的四条边必然贴着 backdrop 自己
 * 或某个浮层的边,所以只需在这些坐标构成的网格上枚举。浮层个数是分区里的
 * 单元格数(个位数),枚举量因此很小,换来的是不必依赖任何贪心假设。
 */
export function backdropSafeArea(
  backdrop: SafeAreaRect,
  overlays: readonly SafeAreaRect[]
): SafeAreaRect | null {
  if (backdrop.width <= 0 || backdrop.height <= 0) return null;

  const frame = bounds(backdrop);
  // 只有真正压在 backdrop 上的浮层才参与切割;完全在外面的不构成遮挡。
  const blockers = overlays.map(bounds).filter((overlay) => overlaps(frame, overlay));
  if (blockers.length === 0) return { ...backdrop };

  const xs = sortedUnique([
    frame.left,
    frame.right,
    ...blockers.flatMap((overlay) => [overlay.left, overlay.right])
  ]).filter((value) => value >= frame.left && value <= frame.right);
  const ys = sortedUnique([
    frame.top,
    frame.bottom,
    ...blockers.flatMap((overlay) => [overlay.top, overlay.bottom])
  ]).filter((value) => value >= frame.top && value <= frame.bottom);

  let best: SafeAreaRect | null = null;
  let bestArea = 0;

  for (let leftIndex = 0; leftIndex < xs.length - 1; leftIndex += 1) {
    for (let rightIndex = xs.length - 1; rightIndex > leftIndex; rightIndex -= 1) {
      const left = xs[leftIndex]!;
      const right = xs[rightIndex]!;
      const width = right - left;
      if (width <= 0 || width * (frame.bottom - frame.top) <= bestArea) break;

      for (let topIndex = 0; topIndex < ys.length - 1; topIndex += 1) {
        for (let bottomIndex = ys.length - 1; bottomIndex > topIndex; bottomIndex -= 1) {
          const top = ys[topIndex]!;
          const bottom = ys[bottomIndex]!;
          const height = bottom - top;
          const area = width * height;
          if (height <= 0 || area <= bestArea) break;

          const candidate: Bounds = { left, top, right, bottom };
          if (blockers.some((overlay) => overlaps(candidate, overlay))) continue;

          bestArea = area;
          best = { x: left, y: top, width, height };
        }
      }
    }
  }

  return best;
}

/**
 * 矩形 → IFC 约定的四个自定义属性。四者**同时缺席**才表示「没有安全区约束」,
 * 所以调用方在无解时不要只清掉其中一部分。
 */
export function safeAreaCustomProperties(rect: SafeAreaRect): Record<string, string> {
  return {
    '--mc-backdrop-safe-x': `${rect.x}px`,
    '--mc-backdrop-safe-y': `${rect.y}px`,
    '--mc-backdrop-safe-w': `${rect.width}px`,
    '--mc-backdrop-safe-h': `${rect.height}px`
  };
}

export const SAFE_AREA_PROPERTY_NAMES = [
  '--mc-backdrop-safe-x',
  '--mc-backdrop-safe-y',
  '--mc-backdrop-safe-w',
  '--mc-backdrop-safe-h'
] as const;
