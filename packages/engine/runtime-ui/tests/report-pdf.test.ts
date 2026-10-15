import { describe, expect, it } from 'vitest';
import { reportPdfFilename } from '../src/report-pdf-context';

describe('Report PDF 文件名', () => {
  it('默认取触发页头标题，清理路径字符并且不重复扩展名', () => {
    expect(reportPdfFilename({title:'经营/报告'})).toBe('经营_报告.pdf');
    expect(reportPdfFilename({title:'报告',pdfExport:{filename:'月报.PDF'}})).toBe('月报.pdf');
    expect(reportPdfFilename({title:'报告',pdfExport:{filename:'   '}})).toBe('导出报告.pdf');
  });
});
