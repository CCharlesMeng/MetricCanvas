import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.env.REPORT_PDF_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-pdf-appearance';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const failures = [];
try {
  await page.goto(`${root}/preview?prototype=report-date`);
  await expect(page.getByText('项目 01', { exact: false }).first()).toBeVisible();
  await page.evaluate(async () => {
    window.frozenCharts = [];
    document.addEventListener('metriccanvas:freeze-export-chart', event => {
      const canvas = event.target.querySelector('canvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let bars = 0, previous = false;
      for (let x = 0; x < canvas.width; x++) {
        let colored = false;
        for (let y = 30; y < canvas.height - 45; y++) {
          const i = (y * canvas.width + x) * 4;
          if (pixels[i + 2] > pixels[i] + 60 && pixels[i + 2] > pixels[i + 1] + 30 && pixels[i + 3] > 200) { colored = true; break; }
        }
        if (colored && !previous) bars++;
        previous = colored;
      }
      window.frozenCharts.push({
        rows: Number(event.target.closest('.bar-chart').dataset.monthCount), bars
      });
    }, true);
    window.encodedImages = [];
    window.exportBackgrounds = [];
    document.addEventListener('load', event => {
      if (event.target instanceof HTMLIFrameElement && event.target.hasAttribute('data-report-pdf-frame')) {
        const view = event.target.contentDocument.querySelector('[data-export-view]');
        window.exportBackgrounds.push(getComputedStyle(view).backgroundColor);
      }
    }, true);
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      const result = original.apply(this, args);
      const view = document.querySelector('[data-report-pdf-frame]')?.contentDocument?.querySelector('[data-export-view]');
      if (view && this.width === Math.floor(view.getBoundingClientRect().width * 2)) window.encodedImages.push(result);
      return result;
    };
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PDF', exact: true }).click();
  await (await download).saveAs(path.join(output, 'report.pdf'));
  const charts = await page.evaluate(() => window.frozenCharts);
  const canvasBackground = await page.evaluate(() => ({
    original: getComputedStyle(document.querySelector('.page-content')).backgroundColor,
    exported: window.exportBackgrounds[0]
  }));
  try { expect(canvasBackground.exported).toBe(canvasBackground.original); }
  catch (error) { failures.push(`page background: ${error.message}`); }
  try {
    expect(charts).toHaveLength(1);
    expect(charts[0].bars).toBe(charts[0].rows);
  } catch (error) { failures.push(`full chart: ${error.message}`); }
  const images = await page.evaluate(() => window.encodedImages);
  await writeFile(path.join(output, 'cover.png'), Buffer.from(images[0].split(',')[1], 'base64'));
  await writeFile(path.join(output, 'chart.png'), Buffer.from(images.at(-1).split(',')[1], 'base64'));

  // A scoped pseudo-element owns the background, as in report heading badges.
  const backgroundDownload = page.waitForEvent('download');
  const background = await page.evaluate(async () => {
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const style = document.createElement('style');
    style.textContent = '.pdf-background-fixture {position:relative;width:718px;padding:40px 0;line-height:20px;isolation:isolate} .pdf-background-fixture::before {content:"";position:absolute;inset:0;background:linear-gradient(90deg,#dbeafe,#22c55e);z-index:-1}';
    const source = document.createElement('div');
    source.dataset.exportView = '';
    source.style.width = '718px';
    source.innerHTML = '<div class="pdf-background-fixture">背景</div>';
    document.head.append(style); document.body.append(source);
    try {
      await downloadReportPdf(source, new AbortController().signal, 'background.pdf');
      const image = new Image(); image.src = window.encodedImages.at(-1); await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      return { left: Array.from(ctx.getImageData(40, 30, 1, 1).data), right: Array.from(ctx.getImageData(1380, 30, 1, 1).data) };
    } finally { source.remove(); style.remove(); }
  });
  await (await backgroundDownload).saveAs(path.join(output, 'background.pdf'));
  try {
    expect(background.left[2]).toBeGreaterThan(background.left[0]);
    expect(background.right[1]).toBeGreaterThan(background.right[0] + 80);
  } catch (error) { failures.push(`background pixels: ${error.message}`); }
  await writeFile(path.join(output, 'appearance.json'), JSON.stringify({ charts, canvasBackground, background, failures }, null, 2));
  console.log(JSON.stringify({ charts, canvasBackground, background, failures }));
  expect(failures).toEqual([]);
} finally { await browser.close(); }
