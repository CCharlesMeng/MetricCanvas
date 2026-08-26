import { describe, expect, it } from 'vitest';
import { compositeCardFlow } from '../src/components/composite-card/flow';

/** 只看分隔线那三位:位置由落位派生,断言因此写在落位上而不是坐标上。 */
function dividers(spans: number[]) {
  return compositeCardFlow(spans).map((slot) => ({
    row: slot.row,
    above: slot.precededByRow,
    before: slot.precededInRow
  }));
}

describe('compositeCardFlow · 12 列自动流落位', () => {
  it('装得下就同行,装不下整个移到下一行,本行剩下的列空着', () => {
    expect(compositeCardFlow([4, 4, 3]).map((slot) => slot.row)).toEqual([0, 0, 0]);
    // 4 + 4 + 5 > 12:第三个整体下行,第一行右侧空出四列
    expect(compositeCardFlow([4, 4, 5]).map((slot) => slot.row)).toEqual([0, 0, 1]);
  });

  it('概览页那张卡:一个满宽加两个半宽,写成两行', () => {
    expect(compositeCardFlow([12, 6, 6]).map((slot) => slot.row)).toEqual([0, 1, 1]);
  });

  it('清单页那张 2×2:四个半宽正好两行两列', () => {
    expect(compositeCardFlow([6, 6, 6, 6]).map((slot) => slot.row)).toEqual([0, 0, 1, 1]);
  });

  it('声明值超出栅格时夹到 12,并且不因此换到空行的下一行', () => {
    expect(compositeCardFlow([99])).toEqual([
      {
        row: 0,
        span: 12,
        precededInRow: false,
        followedInRow: false,
        precededByRow: false
      }
    ]);
  });

  it('声明值小于一列时夹到 1', () => {
    expect(compositeCardFlow([0, -3]).map((slot) => slot.span)).toEqual([1, 1]);
  });
});

describe('compositeCardFlow · 分隔线位置由结构派生', () => {
  it('行与行之间画横线,同一行相邻子组件之间画竖线', () => {
    expect(dividers([12, 6, 6])).toEqual([
      { row: 0, above: false, before: false },
      { row: 1, above: true, before: false },
      { row: 1, above: true, before: true }
    ]);
  });

  it('2×2 分格:第二行两个都带横线,每行的第二个带竖线', () => {
    expect(dividers([6, 6, 6, 6])).toEqual([
      { row: 0, above: false, before: false },
      { row: 0, above: false, before: true },
      { row: 1, above: true, before: false },
      { row: 1, above: true, before: true }
    ]);
  });

  it('只有一个子组件时一条线都不画', () => {
    expect(dividers([12])).toEqual([{ row: 0, above: false, before: false }]);
  });

  it('在中间插入一个子组件不需要改别人的声明,线位自己跟着落位走', () => {
    const before = dividers([6, 6]);
    const after = dividers([6, 6, 6]);

    // 原来的两个仍在第一行、仍只有第二个带竖线;新来的落到第二行并带上横线
    expect(after.slice(0, 2)).toEqual(before);
    expect(after[2]).toEqual({ row: 1, above: true, before: false });
  });

  it('横线只向行内有邻居的那一侧跨过列间距,相邻两段因此连成一条', () => {
    expect(
      compositeCardFlow([12, 6, 6]).map((slot) => [slot.precededInRow, slot.followedInRow])
    ).toEqual([
      [false, false],
      [false, true],
      [true, false]
    ]);
  });
});
