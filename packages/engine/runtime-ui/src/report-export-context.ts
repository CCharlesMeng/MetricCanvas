import type { ReportHeaderProps } from '@metriccanvas/page/internal';

export type ReportExportButton = NonNullable<ReportHeaderProps['exportButtons']>[number];
export const REPORT_EXPORT_CONTEXT = Symbol('metriccanvas.reportExport');
export interface ReportExportContext {
  readonly busy: boolean;
  readonly active?: ReportExportButton;
  readonly error?: string;
  readonly message: string;
  download(props: ReportHeaderProps, button: ReportExportButton): Promise<void>;
}

/** Compatibility ends here: every declared export renders the same direct-download button. */
export function reportExportButtons(props: ReportHeaderProps): ReportExportButton[] {
  return props.exportButtons ?? [
    ...(props.pdfExport ? [{ format: 'pdf' as const, label: '下载 PDF', ...props.pdfExport }] : []),
    ...(props.pngExport ? [{ format: 'png' as const, ...props.pngExport }] : [])
  ];
}

export function reportExportFilename(props: ReportHeaderProps, button: ReportExportButton): string {
  const name = (button.filename || props.title || '导出报告')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()
    .replace(/(?:\.(?:png|jpe?g|webp|gif|zip|pdf))+$/i, '').slice(0, 120);
  return `${name || '导出报告'}.${button.format}`;
}

export function downloadReportBlob(owner: Document, blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = owner.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  owner.body.append(link);
  try { link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }
}
