import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.env.REPORT_PDF_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-pdf-fidelity';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const failures = [];
try {
  await page.goto(`${root}/preview?prototype=report-date`);
  await page.locator('.echart canvas').first().waitFor();
  await page.evaluate(() => {
    window.fidelityImages = [];
    window.tableHeaderColors = [];
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      const result = original.apply(this, args);
      if (document.querySelector('[data-report-pdf-frame]') && this.width === 1436) window.fidelityImages.push(result);
      if (document.querySelector('[data-report-pdf-frame]') && this.width > 600 && this.width < 800 && this.height < 100) {
        window.tableHeaderColors.push(Array.from(this.getContext('2d').getImageData(5, 5, 1, 1).data));
      }
      return result;
    };
    const facts = root => {
      const origin = root.getBoundingClientRect();
      const box = element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height };
      };
      return {
        boxes: Array.from(root.querySelectorAll('[data-fidelity-box]')).map(box),
        gradient: root.querySelector('h1') ? getComputedStyle(root.querySelector('h1')).backgroundImage : undefined,
        sectionMargin: root.querySelector('.page-section') ? getComputedStyle(root.querySelector('.page-section')).marginBottom : undefined
      };
    };
    window.fidelityFacts = facts;
    document.addEventListener('load', event => {
      const frame = event.target;
      if (frame instanceof HTMLIFrameElement && frame.hasAttribute('data-report-pdf-frame')) {
        window.fidelityCopy = facts(frame.contentDocument.querySelector('[data-export-view]'));
      }
    }, true);
  });
  const download = page.waitForEvent('download');
  const source = await page.evaluate(async () => {
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const source = document.createElement('div');
    source.dataset.exportView = '';
    source.style.cssText = 'width:718px;background:white;font-family:Arial;line-height:24px';
    source.innerHTML = '<header class="short-bar"><h1 style="display:inline-block;width:400px;height:72px;margin:0;font:900 52px/72px Arial;color:transparent;background:linear-gradient(90deg,#ef4444,#3b82f6);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent">MMMMMMMM</h1></header>' +
      '<section class="page-section" style="margin-bottom:37px"><div class="section-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' +
      ['A', 'B', 'C', 'D'].map(label => `<div class="cell" data-fidelity-box style="height:120px;min-height:120px;padding:10px;border:2px solid #1476ff;box-sizing:border-box;background:#e8f1ff;border-radius:12px"><div style="width:100%">卡片 ${label}</div></div>`).join('') + '</div></section>' +
      '<div data-fidelity-box style="height:45px;background:#dcfce7">后续正文</div>';
    document.body.append(source);
    const facts = window.fidelityFacts(source);
    try {
      await downloadReportPdf(source, new AbortController().signal, 'fidelity.pdf');
      const image = new Image(); image.src = window.fidelityImages.at(-1); await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, 800, 144).data;
      let red = 0, blue = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > pixels[i + 2] + 40 && pixels[i] > pixels[i + 1] + 40) red++;
        if (pixels[i + 2] > pixels[i] + 40 && pixels[i + 2] > pixels[i + 1] + 40) blue++;
      }
      window.gradientPixels = { red, blue, blank: Array.from(context.getImageData(790, 10, 1, 1).data) };
      return facts;
    } finally { source.remove(); }
  });
  await (await download).saveAs(path.join(output, 'fidelity.pdf'));
  const result = await page.evaluate(() => ({ copied: window.fidelityCopy, gradientPixels: window.gradientPixels, image: window.fidelityImages.at(-1) }));
  for (const [name, check] of [
    ['layout, dimensions and spacing', () => expect(result.copied.boxes).toEqual(source.boxes)],
    ['section spacing', () => expect(result.copied.sectionMargin).toBe(source.sectionMargin)],
    ['gradient title styles', () => expect(result.copied.gradient).toBe(source.gradient)],
    ['gradient text pixels', () => { expect(result.gradientPixels.red).toBeGreaterThan(100); expect(result.gradientPixels.blue).toBeGreaterThan(100); expect(result.gradientPixels.blank).toEqual([255, 255, 255, 255]); }]
  ]) { try { check(); } catch (error) { failures.push(`${name}: ${error.message}`); } }
  await writeFile(path.join(output, 'fidelity.png'), Buffer.from(result.image.split(',')[1], 'base64'));
  await writeFile(path.join(output, 'fidelity.json'), JSON.stringify({ source, copied: result.copied, gradientPixels: result.gradientPixels, failures }, null, 2));
  console.log(JSON.stringify({ source, copied: result.copied, gradientPixels: result.gradientPixels, failures }));
  expect(failures).toEqual([]);

  const parallelDownload = page.waitForEvent('download');
  const parallel = await page.evaluate(async () => {
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const source = document.createElement('div'); source.dataset.exportView = ''; source.style.width = '718px';
    source.innerHTML = '<div class="section-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font:14px/20px Arial">' + ['#dbeafe', '#dcfce7'].map((color, index) =>
      `<table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th style="padding:6px;background:${color}">表头 ${index + 1}</th></tr></thead><tbody>` +
      Array.from({ length: 40 }, (_, row) => `<tr><td style="padding:5px;border-bottom:1px solid #ddd">Row ${row + 1}</td></tr>`).join('') + '</tbody></table>').join('') + '</div>';
    document.body.append(source);
    try { return await downloadReportPdf(source, new AbortController().signal, 'parallel-tables.pdf'); }
    finally { source.remove(); }
  });
  await (await parallelDownload).saveAs(path.join(output, 'parallel-tables.pdf'));
  expect(parallel.pageCount).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.tableHeaderColors)).toEqual([]); // No additional header images or inserted rows.
  console.log(JSON.stringify({ parallelTables: 'pass', pages: parallel.pageCount }));
} finally { await browser.close(); }
