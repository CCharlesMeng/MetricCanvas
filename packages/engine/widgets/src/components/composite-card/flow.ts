/**
 * 卡内 12 列自动流的落位,以及分隔线由落位派生的位置(ADR-0053)。
 *
 * 分隔线在页面文档里只有一位布尔,位置不写索引也不写坐标:线画在自动流
 * **已经形成**的单元格边界上——行与行之间是横线,同一行相邻子组件之间是竖线。
 * 因此这里先把「第几行、行内有没有邻居」算出来,样式只消费这三位布尔。
 *
 * 落位规则与 CSS Grid 的缺省自动放置(sparse)逐字一致:游标不回退,
 * 装不下的子组件整个移到下一行,本行剩下的列空着。
 */

/** 卡内复用同一条 12 列栅格,不引入第二套布局词汇(ADR-0053)。 */
export const COMPOSITE_CARD_COLUMNS = 12;

export interface CompositeCardSlot {
  /** 自动流分配到的行序号,0 起。 */
  row: number;
  /** 实际占用的列数:声明值夹在 1..columns,与栅格能表达的范围一致。 */
  span: number;
  /** 行内有前一个兄弟 → 左边界画竖线。 */
  precededInRow: boolean;
  /** 行内有后一个兄弟 → 横线向右跨过列间距,与邻居的那一段接上。 */
  followedInRow: boolean;
  /** 上方还有一行 → 上边界画横线。 */
  precededByRow: boolean;
}

export function compositeCardFlow(
  spans: readonly number[],
  columns: number = COMPOSITE_CARD_COLUMNS
): CompositeCardSlot[] {
  const placed: Array<Omit<CompositeCardSlot, 'followedInRow'>> = [];
  let row = 0;
  let filled = 0;
  for (const declared of spans) {
    const span = Math.min(columns, Math.max(1, Math.trunc(declared)));
    // filled === 0 时不换行:夹到 columns 的子组件在空行上总是装得下
    if (filled > 0 && filled + span > columns) {
      row += 1;
      filled = 0;
    }
    placed.push({
      row,
      span,
      precededInRow: filled > 0,
      precededByRow: row > 0
    });
    filled += span;
  }
  return placed.map((slot, index) => ({
    ...slot,
    followedInRow: placed[index + 1]?.row === slot.row
  }));
}
