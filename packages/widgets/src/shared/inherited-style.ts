/**
 * 经继承可见的自定义属性的读取(包内私有)。
 *
 * 页面布局形态在祖先节点上覆写自定义属性,绝大多数消费点是 CSS 声明、直接
 * `var()` 就够。少数量不是声明:图表色板要塞进 ECharts option,表头行高同时
 * 是 JS 里的粘性偏移。这些量只能从元素的计算样式读回脚本,读法在这里统一一份。
 *
 * 自定义属性变化不触发任何观察器。形态只随页面整体重渲染变化,所以这些量
 * 读一次即定;随几何变化的量(如安全区)自己挂重读时机,不在这里。
 */

/** 计算样式里的像素长度。属性缺席、为空或非有限数即 `undefined`。 */
export function readPixelLength(
  element: Element | null | undefined,
  property: string
): number | undefined {
  if (!element) return undefined;
  const raw = getComputedStyle(element).getPropertyValue(property).trim();
  if (raw === '') return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 计算样式里的原始属性值(未解析)。属性缺席即空串。 */
export function readCustomProperty(
  element: Element | null | undefined,
  property: string
): string {
  return element ? getComputedStyle(element).getPropertyValue(property) : '';
}
