import { describe, expect, it } from 'vitest';
import { planPdfPages } from '../src/report-pdf-pagination';

describe('continuous report PDF', () => {
  it('preserves content order without chapter gaps, repeated headers or keep-together reflow', () => {
    expect(planPdfPages(2506, 1749)).toEqual([
      { top: 0, bottom: 1749, headerHeight: 0 },
      { top: 1749, bottom: 2506, headerHeight: 0 }
    ]);
  });
  it('slices oversized content without dropping pixels or rejecting the whole report', () => {
    expect(planPdfPages(250, 100)).toEqual([
      { top: 0, bottom: 100, headerHeight: 0 },
      { top: 100, bottom: 200, headerHeight: 0 },
      { top: 200, bottom: 250, headerHeight: 0 }
    ]);
  });
});
