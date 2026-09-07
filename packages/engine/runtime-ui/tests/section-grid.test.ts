import { describe, expect, it } from 'vitest';
import { sectionGridColumnCount, sectionGridTemplate } from '../src/section-grid';

describe('内容分区列轨', () => {
  it('缺省保持 12 条等权列', () => {
    expect(sectionGridColumnCount()).toBe(12);
    expect(sectionGridTemplate()).toBe('repeat(12, minmax(0, 1fr))');
  });

  it('把受控整数权重编译成运行时列轨', () => {
    expect(sectionGridColumnCount([29, 29, 22])).toBe(3);
    expect(sectionGridTemplate([29, 29, 22])).toBe(
      'minmax(0, 29fr) minmax(0, 29fr) minmax(0, 22fr)'
    );
  });
});
