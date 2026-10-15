import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.REPORT_PDF_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-pdf-continuous';
await mkdir(output, { recursive: true });
const input = JSON.parse(await readFile(new URL('../../../pages/sdt/commercial-sdt-efficiency-ultimate-monthly.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${base}/preview?prototype=report-date`);
  await page.locator('.echart canvas').first().waitFor();
  await page.evaluate(async input => {
    const { mountPdfRuntimeFixture } = await import('/tests/report-pdf-runtime-fixture.ts');
    const host = document.createElement('div'); host.id = 'sdt-continuous'; host.style.width = '1200px'; document.body.append(host);
    window.sdtFixture = mountPdfRuntimeFixture(host, input, { async fetchData(_query, context) {
      const id = context.dataSourceIds[0];
      const fields = input.dataSources[id].fields;
      const rows = Array.from({ length: id.includes('trend') ? 6 : 10 }, (_, index) => Object.fromEntries(Object.entries(fields).map(([name, field]) => [name,
        field.type === 'number' || field.type === 'money' ? Number(((index + 1) * 0.51).toFixed(2)) : name === 'time' ? `2026-${String(index + 5).padStart(2, '0')}` : `${field.label ?? name} ${index + 1}`
      ])));
      return { rows, totalCount: rows.length };
    } });
  }, input);
  await expect(page.locator('#sdt-continuous h1')).toContainText('商务SDT');
  await page.locator('#sdt-continuous canvas').first().waitFor();
  await page.locator('#sdt-continuous').screenshot({ path: path.join(output, 'screen.png') });
  let download = page.waitForEvent('download');
  const result = await page.evaluate(async () => {
    const started = performance.now();
    let facts;
    const pdf = await window.sdtFixture.export(view => {
      const rect = view.getBoundingClientRect();
      facts = { width: rect.width, height: rect.height, sections: view.querySelectorAll('[data-section-id]').length, rows: view.querySelectorAll('tbody tr').length,
        lastSection: view.querySelector('[data-section-id="decision-maker-efficiency-section"]')?.textContent };
    });
    return { ...facts, ...pdf, elapsedMs: Math.round(performance.now() - started) };
  });
  await (await download).saveAs(path.join(output, 'sdt.pdf'));
  expect(result.sections).toBe(6);
  expect(result.rows).toBeGreaterThanOrEqual(40);
  expect(result.lastSection).toContain('决策人');
  expect(result.pageCount).toBe(Math.ceil(result.height / Math.floor(result.width * 297 / 210)));
  await expect(page.locator('[data-report-pdf-frame],[data-metriccanvas-export-stage]')).toHaveCount(0);

  // A known raster verifies every source row, including both sides of every paper seam.
  download = page.waitForEvent('download');
  const seams = await page.evaluate(async () => {
    const { downloadReportPdf } = await import('/src/lib/report-pdf-client.ts');
    const original = HTMLCanvasElement.prototype.toDataURL;
    const slices = [];
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      const data = original.apply(this, args);
      if (this.width === 1436 && document.querySelector('[data-report-pdf-frame]')) slices.push(data);
      return data;
    };
    const source = document.createElement('div'); source.dataset.exportView = ''; source.style.cssText = 'width:718px;height:3500px;margin:0;padding:0';
    const raster = document.createElement('canvas'); raster.width = 718; raster.height = 3500;
    const context = raster.getContext('2d');
    for (let y = 0; y < raster.height; y++) {
      context.fillStyle = `rgb(${y % 251},${Math.floor(y / 251) * 17},${250 - y % 251})`; context.fillRect(0, y, 718, 1);
    }
    const img = document.createElement('img'); img.src = raster.toDataURL(); img.style.cssText = 'display:block;width:718px;height:3500px'; source.append(img); document.body.append(source); await img.decode();
    try {
      const pdf = await downloadReportPdf(source, new AbortController().signal, 'seams.pdf');
      const reference = document.createElement('canvas'); reference.width = 1436; reference.height = 7000;
      const referenceContext = reference.getContext('2d'); referenceContext.drawImage(raster, 0, 0, 1436, 7000);
      const expectedPixels = referenceContext.getImageData(4, 0, 1, 7000).data;
      let row = 0, mismatch = 0;
      for (const url of slices) {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(4, 0, 1, canvas.height).data;
        for (let y = 0; y < canvas.height; y++, row++) {
          if ([0, 1, 2].some(channel => Math.abs(expectedPixels[row * 4 + channel] - pixels[y * 4 + channel]) > 2)) mismatch++;
        }
      }
      return { ...pdf, sourceRows: row / 2, mismatch };
    } finally { source.remove(); HTMLCanvasElement.prototype.toDataURL = original; }
  });
  await (await download).saveAs(path.join(output, 'seams.pdf'));
  expect(seams.sourceRows).toBe(3500);
  expect(seams.mismatch).toBe(0);
  expect(seams.pageCount).toBe(4);
  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ result, seams, errors }, null, 2));
  console.log(JSON.stringify({ status: 'pass', result, seams, output }));
} finally { await browser.close(); }
