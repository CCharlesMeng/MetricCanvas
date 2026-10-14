import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.env.REPORT_PDF_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-report-pdf';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
page.setDefaultTimeout(60_000);
const errors = [], externalRequests = [], encoderRequests = [], downloads = [], cases = [];
page.on('pageerror', error => errors.push(error.message));
page.on('download', download => downloads.push(download));
page.on('request', request => {
  if (request.url().includes('__report-pdf')) encoderRequests.push(request.url());
  if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(root).origin) externalRequests.push(request.url());
});
await page.addInitScript(() => {
  window.pdfViews = [];
  window.pdfCanvases = [];
  window.printCalls = 0;
  window.pdfMode = 'normal';
  window.print = () => { window.printCalls++; };
  const original = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    if (document.querySelector('[data-report-pdf-frame]')) {
      const view = document.querySelector('[data-report-pdf-frame]').contentDocument.querySelector('[data-export-view]');
      const width = view.getBoundingClientRect().width;
      window.pdfCanvases.push({ width: this.width, height: this.height, limitWidth: Math.ceil(width * 2), limitHeight: Math.ceil(width * 277 / 190) * 2 });
      if (window.pdfMode === 'fail') throw new Error('模拟 PDF 图片编码失败');
      if (window.pdfMode === 'update') {
        window.pdfMode = 'normal';
        const select = document.querySelector('select');
        select.value = 'month';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (window.pdfMode === 'cancel') window.pdfController.abort(new Error('集成应用取消 PDF'));
    }
    return original.apply(this, args);
  };
  document.addEventListener('load', event => {
    const frame = event.target;
    if (!(frame instanceof HTMLIFrameElement) || !frame.hasAttribute('data-report-pdf-frame')) return;
    frame.contentWindow.print = () => { window.printCalls++; };
    const doc = frame.contentDocument;
    window.pdfViews.push({
      rows: doc.querySelectorAll('tbody tr').length,
      tables: doc.querySelectorAll('table').length,
      controls: doc.querySelectorAll('button,input,select').length,
      images: Array.from(doc.images).map(image => ({ width: image.width, height: image.height })),
      charts: Array.from(doc.querySelectorAll('[data-export-chart]')).map(chart => ({
        height: chart.getBoundingClientRect().height,
        imageHeight: Math.max(...Array.from(chart.querySelectorAll('img')).map(image => image.getBoundingClientRect().height))
      })),
      text: doc.body.textContent,
      height: doc.querySelector('[data-export-view]').getBoundingClientRect().height
    });
  }, true);
});
async function cleaned() {
  await expect(page.locator('[data-report-pdf-frame]')).toHaveCount(0);
  await expect(page.locator('[data-metriccanvas-export-stage]')).toHaveCount(0);
}
try {
  await page.goto(`${root}/preview?prototype=report-date`);
  await expect(page.getByText('项目 01', { exact: false }).first()).toBeVisible();
  const button = page.getByRole('button', { name: '导出 PDF', exact: true });
  const waiting = page.waitForEvent('download');
  await button.click();
  const downloaded = await waiting;
  expect(downloaded.suggestedFilename()).toBe('经营分析报告.pdf');
  await downloaded.saveAs(path.join(output, 'report.pdf'));
  await expect(page.getByRole('status')).toContainText('159 行');
  await cleaned();
  const facts = await page.evaluate(() => window.pdfViews[0]);
  expect(facts.rows).toBe(159);
  expect(facts.tables).toBe(3);
  expect(facts.controls).toBe(0);
  expect(facts.images.length).toBeGreaterThan(0);
  expect(facts.charts.length).toBeGreaterThan(0);
  expect(facts.charts.every(chart => chart.height > 100 && chart.height >= chart.imageHeight)).toBe(true);
  expect(facts.text).toContain('项目 53');
  expect(facts.text).toContain('2026-01');
  expect(facts.text).toContain('2026-06');
  cases.push('real browser download includes all 159 rows, inactive groups/tabs, static charts and current period');
  await page.screenshot({ path: path.join(output, 'downloaded.png'), fullPage: true });

  const repeated = page.waitForEvent('download');
  await button.click();
  await repeated;
  await cleaned();
  await expect(button).toBeEnabled();
  cases.push('repeat download clears iframe and engine temporary DOM');

  const count = downloads.length;
  await page.evaluate(() => { window.pdfMode = 'fail'; });
  await button.click();
  await expect(page.getByRole('status')).toHaveText('模拟 PDF 图片编码失败');
  await cleaned();
  await expect(button).toBeEnabled();
  expect(downloads.length).toBe(count);
  cases.push('image encoding failure produces no partial download and cleans both views');

  await page.evaluate(() => { window.pdfMode = 'update'; });
  await button.click();
  await expect(page.getByRole('status')).toHaveText('页面实例已更新');
  await cleaned();
  expect(downloads.length).toBe(count);
  cases.push('page update cancels between page images with no stale download');

  const cancelled = await page.evaluate(async () => {
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const controller = new AbortController();
    controller.abort(new Error('提前取消'));
    try { await downloadReportPdf(document.body, controller.signal); }
    catch (error) { return error.message; }
  });
  expect(cancelled).toBe('提前取消');
  await cleaned();
  cases.push('pre-aborted request allocates no encoder iframe and never downloads');

  const imageError = await page.evaluate(async () => {
    window.pdfMode = 'normal';
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const source = document.createElement('div');
    source.dataset.exportView = '';
    source.innerHTML = '<img src="data:image/png;base64,invalid" alt="broken">';
    document.body.append(source);
    try { await downloadReportPdf(source, new AbortController().signal); }
    catch (error) { return error.message; }
    finally { source.remove(); }
  });
  expect(imageError).toBeTruthy();
  await cleaned();
  expect(downloads.length).toBe(count);
  cases.push('missing image refuses an incomplete PDF');

  const duringEncoding = await page.evaluate(async () => {
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const source = document.createElement('div');
    source.dataset.exportView = '';
    source.innerHTML = '<p>正在编码时取消</p>';
    document.body.append(source);
    window.pdfController = new AbortController();
    window.pdfMode = 'cancel';
    try { await downloadReportPdf(source, window.pdfController.signal); }
    catch (error) { return error.message; }
    finally { source.remove(); window.pdfMode = 'normal'; }
  });
  expect(duringEncoding).toBe('集成应用取消 PDF');
  await cleaned();
  expect(downloads.length).toBe(count);
  cases.push('cancellation during encoding waits for active canvas then prevents download and cleans iframe');

  const tooTall = await page.evaluate(async () => {
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const source = document.createElement('div');
    source.dataset.exportView = '';
    source.innerHTML = '<p style="padding:1200px 0">过高的不可拆分正文</p>';
    document.body.append(source);
    try { await downloadReportPdf(source, new AbortController().signal); }
    catch (error) { return error.message; }
    finally { source.remove(); }
  });
  expect(tooTall).toContain('超过 A4 页高');
  await cleaned();
  expect(downloads.length).toBe(count);
  cases.push('oversized indivisible content explicitly fails instead of cropping');

  // A whole-report scale=2 canvas here would be more than 32,000 pixels high.
  const longDownload = page.waitForEvent('download');
  const longResult = page.evaluate(async () => {
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const source = document.createElement('div');
    source.dataset.exportView = '';
    source.innerHTML = '<table style="width:700px;border-collapse:collapse;font-size:14px;line-height:18px"><thead><tr><th style="padding:9px">Row</th><th>Value</th></tr></thead><tbody>' +
      Array.from({ length: 500 }, (_, index) => `<tr><td style="padding:9px;border:1px solid #bbb">Row ${index + 1}</td><td>${index + 1}</td></tr>`).join('') + '</tbody></table>';
    source.style.width = '718px';
    document.body.append(source);
    try { return await downloadReportPdf(source, new AbortController().signal, 'long-report.pdf'); }
    finally { source.remove(); }
  });
  await (await longDownload).saveAs(path.join(output, 'long-report.pdf'));
  const long = await longResult;
  expect(long.pageCount).toBeGreaterThan(15);
  expect(await page.evaluate(() => window.pdfViews.at(-1).height)).toBeGreaterThan(16_000);
  await cleaned();
  cases.push('500-row long report downloads using only bounded A4 canvases');

  const canvases = await page.evaluate(() => window.pdfCanvases);
  expect(canvases.length).toBeGreaterThan(20);
  expect(canvases.every(canvas => canvas.width <= canvas.limitWidth && canvas.height <= canvas.limitHeight)).toBe(true);
  expect(await page.evaluate(() => window.printCalls)).toBe(0);
  expect(errors).toEqual([]);
  expect(encoderRequests).toEqual([]);
  expect(externalRequests).toEqual([]);
  await writeFile(path.join(output, 'browser-report.json'), JSON.stringify({ status: 'pass', cases, source: facts, longReport: long, canvases, pageErrors: errors, encoderRequests, externalRequests, downloads: downloads.map(download => download.suggestedFilename()) }, null, 2));
  console.log(JSON.stringify({ status: 'pass', cases: cases.length, output }));
} catch (error) {
  await writeFile(path.join(output, 'browser-report.json'), JSON.stringify({ status: 'fail', cases, error: String(error), pageErrors: errors }, null, 2));
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  throw error;
} finally { await browser.close(); }
