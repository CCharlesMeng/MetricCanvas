import { reportExportScale } from '@metriccanvas/page/internal';
import { describe, expect, it } from 'vitest';
import { reportExportButtons, reportExportFilename } from '../src/report-export-context';

describe('Report PDF 文件名', () => {
  it('默认取触发页头标题，清理路径字符并且不重复扩展名', () => {
    expect(reportExportFilename({title:'经营/报告'}, {format:'pdf'})).toBe('经营_报告.pdf');
    expect(reportExportFilename({title:'报告'},{format:'pdf',filename:'月报.PDF'})).toBe('月报.pdf');
    expect(reportExportFilename({title:'报告'},{format:'pdf',filename:'   '})).toBe('导出报告.pdf');
  });
});

it('旧PDF/PNG在读取接缝成为相同按钮，保留名称、文件名和倍率', () => {
  expect(reportExportButtons({title:'报告',pdfExport:{label:'旧下载',filename:'旧.pdf'},pngExport:{filename:'图',scale:4}})).toEqual([
    {format:'pdf',label:'旧下载',filename:'旧.pdf'}, {format:'png',filename:'图',scale:4}
  ]);
  const buttons=[{format:'png' as const,label:'导出 PNG',scale:3 as const}];
  expect(reportExportButtons({title:'报告',exportButtons:buttons})).toBe(buttons);
});

it('有效倍率原样使用，其他值按格式回退，与未配置相同', () => {
  for (const value of [undefined,null,0,1,9,2.5,'3',{},[],false]) {
    expect(reportExportScale('pdf',value)).toBe(2);
    expect(reportExportScale('png',value)).toBe(3);
  }
  expect(reportExportScale('png',2)).toBe(3);
  for (const value of [3,4]) {
    expect(reportExportScale('pdf',value)).toBe(value);
    expect(reportExportScale('png',value)).toBe(value);
  }
  expect(reportExportScale('pdf',2)).toBe(2);
});
