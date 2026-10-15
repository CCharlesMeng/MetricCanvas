import { describe, expect, it } from 'vitest';
import { planPdfPages } from '../src/lib/report-pdf-pagination';

describe('report PDF continuous pagination', () => {
  it('covers a long report exactly once without inserted gaps or repeated content', () => {
    const height = 180024;
    const pages = planPdfPages(height, 1046);
    expect(pages[0].top).toBe(0);
    expect(pages.at(-1)!.bottom).toBe(height);
    pages.forEach((page, index) => {
      expect(page.bottom - page.top).toBeLessThanOrEqual(1046);
      expect(page.headerHeight).toBe(0);
      if (index) expect(page.top).toBe(pages[index - 1].bottom);
    });
    expect(pages.reduce((sum, page) => sum + page.bottom - page.top, 0)).toBe(height);
  });
  it('retains the final fractional pixel and avoids extra pages at exact boundaries', () => {
    expect(planPdfPages(200.25, 100).at(-1)).toEqual({ top: 200, bottom: 200.25, headerHeight: 0 });
    expect(planPdfPages(200, 100)).toHaveLength(2);
  });
  it.each([[0, 100], [100, 0], [100, 0.1], [NaN, 100], [100, Infinity]])('rejects invalid dimensions %s / %s', (height, pageHeight) => {
    expect(() => planPdfPages(height, pageHeight)).toThrow('尺寸无效');
  });
});
