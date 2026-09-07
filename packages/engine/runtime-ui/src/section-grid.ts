/**
 * 内容分区列轨：缺省 12 等权列；声明时把受控正整数解释为 fr 权重。
 * 字符串只由运行时生成，页面文档不能注入任意 CSS。
 */
export function sectionGridTemplate(columnTracks?: readonly number[]): string {
  if (!columnTracks || columnTracks.length === 0) {
    return 'repeat(12, minmax(0, 1fr))';
  }
  return columnTracks.map((weight) => `minmax(0, ${weight}fr)`).join(' ');
}

export function sectionGridColumnCount(columnTracks?: readonly number[]): number {
  return columnTracks?.length ?? 12;
}
