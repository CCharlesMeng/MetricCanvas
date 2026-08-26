/**
 * 图表色板通道:色板不是 CSS 声明,而是要塞进 ECharts option 的数据,
 * 所以它走「页面布局形态在祖先节点上写自定义属性、组件从自己的绘图容器
 * 读计算样式」这一条——与 `MapChart` 读 `--mc-backdrop-safe-*` 同一个装置。
 * 形态判定仍然只有 `RuntimeView` 那一处,这里不新增第二个判定点。
 *
 * **缺席即沿用图表库内置色**:报表形态不定义这些属性,读到空串,
 * 色板为 `undefined`,option 里不出现 `color`,取值与改动前逐字相同。
 */

import { readCustomProperty } from './inherited-style';

/** 有序色列。索引即档位;类别取色经 `categoricalColor` 走类别域,不直接吃索引。 */
export type ColorList = readonly string[];

/**
 * 类别色板的自定义属性名。定义点唯一在 `RuntimeView` 的看板形态块里,
 * 消费点在各图表组件——名字写在这里,两边不各拼一份字符串。
 */
export const CATEGORICAL_PALETTE_PROPERTY = '--mc-chart-categorical-colors';

/** 地图分档色的自定义属性名。色列从**高档到低档**,由 `mapOption` 转成分档区间。 */
export const MAP_SCALE_PROPERTY = '--mc-chart-map-scale-colors';

/**
 * CSS 自定义属性里的有序色列 → 数组。
 * 只在**顶层**逗号处切分:`rgb(0 0 0 / 0.05)` 没有逗号,而 `rgba(0,0,0,.05)`
 * 有三个——括号内的逗号属于函数式色值本身,切了就散成四段废值。
 */
export function parseColorList(raw: string): string[] {
  const colors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth = Math.max(0, depth - 1);
    else if (character === ',' && depth === 0) {
      colors.push(raw.slice(start, index));
      start = index + 1;
    }
  }
  colors.push(raw.slice(start));
  return colors.map((color) => color.trim()).filter((color) => color !== '');
}

/** 空色列与缺席等价:两者都表示「沿用图表库内置色」。 */
export function colorListOrUndefined(colors: ColorList): ColorList | undefined {
  return colors.length > 0 ? colors : undefined;
}

/**
 * 元素的计算样式 → 有序色列。属性缺席或为空即 `undefined`。
 * 自定义属性靠继承可读,所以任何落在页面内容里的元素都是合法读取锚点。
 */
export function readColorList(
  element: Element | null | undefined,
  property: string
): ColorList | undefined {
  return colorListOrUndefined(parseColorList(readCustomProperty(element, property)));
}

/**
 * 类别域:类别值按**首次出现**顺序去重。
 *
 * 类别取色的定位量是「类别在域里的位置」而不是「类别在本组件里的序号」。
 * 同一数据源的行序对所有消费方都一样,因此域也一样——饼图第三扇区与分类明细
 * 第三条目只要说的是同一个类别,取到的就是同一个颜色(同色同序)。
 */
export function categoryDomain(values: Iterable<unknown>): string[] {
  const domain: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const category = String(value ?? '');
    if (seen.has(category)) continue;
    seen.add(category);
    domain.push(category);
  }
  return domain;
}

/**
 * 按类别取色。域外类别取 `undefined`(沿用内置色),不静默落到 0 号色上——
 * 那会让两个不同类别撞色,比缺色更难查。
 */
export function categoricalColor(
  palette: ColorList | undefined,
  category: unknown,
  domain: readonly string[]
): string | undefined {
  if (!palette || palette.length === 0) return undefined;
  const position = domain.indexOf(String(category ?? ''));
  return position < 0 ? undefined : palette[position % palette.length];
}

/** 按档位序号取色:柱状图 role 档位、折线系列序号一类没有类别域的场景。 */
export function serialColor(
  palette: ColorList | undefined,
  index: number
): string | undefined {
  if (!palette || palette.length === 0 || index < 0) return undefined;
  return palette[index % palette.length];
}
