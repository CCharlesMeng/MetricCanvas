import { describe, expect, it } from 'vitest';
import { planPdfPages } from '../src/lib/report-pdf-pagination';

describe('report PDF pagination', () => {
  it('keeps whole rows and reserves repeated table headers', () => {
    const rows = [20, 60, 100, 140].map(top => ({ top, bottom: top + 40 }));
    expect(planPdfPages(180, 100, rows, [{ top: 0, bottom: 180, headerEnd: 20, headerHeight: 20 }], [])).toEqual([
      { top: 0, bottom: 100, headerHeight: 0 },
      { top: 100, bottom: 180, headerHeight: 20, headerIndex: 0 }
    ]);
  });
  it('moves a heading with its next content to the following page', () => {
    const pages = planPdfPages(180, 100, [{ top: 80, bottom: 130 }, { top: 100, bottom: 150 }], [], []);
    expect(pages.map(page => [page.top, page.bottom])).toEqual([[0, 80], [80, 180]]);
  });
  it('reserves both side-by-side table headers on a continued page', () => {
    const rows = [24, 64, 104, 144].map(top => ({ top, bottom: top + 40 }));
    expect(planPdfPages(184, 104, rows, [
      { top: 0, bottom: 184, headerEnd: 24, headerHeight: 20 },
      { top: 0, bottom: 184, headerEnd: 24, headerHeight: 24 }
    ], [])).toEqual([
      { top: 0, bottom: 104, headerHeight: 0 },
      { top: 104, bottom: 184, headerHeight: 24, headerIndex: 0, headerIndices: [0, 1] }
    ]);
  });
  it('starts a chart section on a new page without a blank first page', () => {
    const pages = planPdfPages(230, 100, [{ top: 90, bottom: 170 }], [], [0, 90]);
    expect(pages.map(page => [page.top, page.bottom])).toEqual([[0, 90], [90, 190], [190, 230]]);
  });
  it('covers a long table exactly once with bounded page images and no split rows', () => {
    const rows = Array.from({ length: 5000 }, (_, index) => ({ top: 24 + index * 36, bottom: 60 + index * 36 }));
    const height = rows.at(-1)!.bottom;
    const pages = planPdfPages(height, 1046, rows, [{ top: 0, bottom: height, headerEnd: 24, headerHeight: 24 }], []);
    expect(pages[0].top).toBe(0);
    expect(pages.at(-1)!.bottom).toBe(height);
    pages.forEach((page, index) => {
      expect(page.bottom - page.top + page.headerHeight).toBeLessThanOrEqual(1046);
      if (index) expect(page.top).toBe(pages[index - 1].bottom);
    });
    rows.forEach(row => expect(pages.filter(page => row.top >= page.top && row.bottom <= page.bottom)).toHaveLength(1));
  });
  it('rejects a row or chart larger than a page rather than silently cropping', () => {
    expect(() => planPdfPages(200, 100, [{ top: 0, bottom: 120 }], [], [])).toThrow('超过 A4 页高');
  });
  it('rejects invalid dimensions', () => {
    expect(() => planPdfPages(0, 100, [], [], [])).toThrow('尺寸无效');
    expect(() => planPdfPages(100, 0, [], [], [])).toThrow('尺寸无效');
  });
});
