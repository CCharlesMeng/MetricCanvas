/**
 * 内容分区的宽度装箱（创作期布局策略）。纯函数：输入一串组件的比例基线，
 * 输出各组件的 `layout.span`。
 *
 * 组件能力目录的 `defaultSpan` 在这里被当作**相对比例**而不是绝对宽度。
 * 依据是人工搭的看板：目录默认值几乎从不被原样采用，但覆盖后的宽度保持
 * 了默认值之间的比例——一张指标卡（3）配一张柱状图（6）写成 4 + 8，三张
 * 指标卡（各 3）写成 4 + 4 + 4，两张排行卡（各 4）写成 6 + 6。同一条比例
 * 关系，换算到「刚好占满整行」。
 *
 * 装箱只在一个分区内进行，不跨分区搬动组件（ADR-0055：一个口径组一个
 * 分区）。列数按 ADR-0038 的运行时不变量缺省 12，声明了受控权重列轨
 * （ADR-0054）的分区传入轨数。
 */

/** 分区缺省列数：ADR-0038 的运行时不变量，不进入页面文档。 */
export const SECTION_COLUMN_COUNT = 12;

/**
 * 把一个分区内组件的比例基线换算成 span。
 *
 * 先按比例基线贪心分行——一行装不下就换行，与统一运行时的 CSS Grid 缺省
 * 自动放置一致；再把每行按各自比例缩放到恰好占满整行，余数按小数部分从大
 * 到小分配，同样大时给声明在前的那个。因此每个视觉行的 span 之和恒等于
 * 列数，页面不会留下参差的右边缘。
 *
 * 分行只在比例空间里判断（目录 defaultSpan 就是以十二分之几表达的），
 * `columnCount` 只决定最终整数分配，因此权重列轨不会改变分行结果。
 */
export function packSectionSpans(
  ratios: readonly number[],
  columnCount: number = SECTION_COLUMN_COUNT
): number[] {
  const spans: number[] = [];
  for (const row of rowsOf(ratios)) {
    spans.push(...fillRow(row, columnCount));
  }
  return spans;
}

/** 按比例基线贪心分行；单个基线占满一行时独占一行。 */
function rowsOf(ratios: readonly number[]): number[][] {
  const rows: number[][] = [];
  let row: number[] = [];
  let filled = 0;
  for (const ratio of ratios) {
    if (row.length > 0 && filled + ratio > SECTION_COLUMN_COUNT) {
      rows.push(row);
      row = [];
      filled = 0;
    }
    row.push(ratio);
    filled += ratio;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

/** 按比例把一行缩放到恰好占满列数；最大余数法保证之和精确相等。 */
function fillRow(row: readonly number[], columnCount: number): number[] {
  const total = row.reduce((sum, ratio) => sum + ratio, 0);
  const exact = row.map((ratio) => (ratio * columnCount) / total);
  const spans = exact.map((value) => Math.max(1, Math.floor(value)));
  const leftover = columnCount - spans.reduce((sum, span) => sum + span, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) =>
      right.remainder === left.remainder
        ? left.index - right.index
        : right.remainder - left.remainder
    );
  for (let given = 0; given < leftover; given += 1) {
    spans[byRemainder[given % byRemainder.length]!.index] += 1;
  }
  return spans;
}
