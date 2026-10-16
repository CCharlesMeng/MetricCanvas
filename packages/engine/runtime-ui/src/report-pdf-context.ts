import type { ReportHeaderProps } from '@metriccanvas/page/internal';

export const REPORT_PDF_CONTEXT = Symbol('metriccanvas-report-pdf');
export interface ReportPdfContext {
  readonly busy: boolean;
  readonly error?: string;
  readonly message: string;
  download(props: ReportHeaderProps): Promise<void>;
}

export function reportPdfFilename(props: ReportHeaderProps): string {
  const name = (props.pdfExport?.filename || props.title || '导出报告')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.pdf$/i, '').trim().slice(0, 120);
  return `${name || '导出报告'}.pdf`;
}
