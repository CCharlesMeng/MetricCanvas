import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.env.REPORT_PDF_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-pdf-runtime-fidelity';
const width = Number(process.env.REPORT_PDF_FIXTURE_WIDTH ?? 1200);
const layout = process.env.REPORT_PDF_FIXTURE_LAYOUT ?? 'report';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${root}/preview?prototype=report-date`);
  await page.locator('.echart canvas').first().waitFor();
  await page.evaluate(async ({ width, layout }) => {
    const { mountPdfRuntimeFixture } = await import('/tests/report-pdf-runtime-fixture.ts');
    const source = document.createElement('div'); source.id = 'runtime-fidelity'; source.style.width = `${width}px`; document.body.append(source);
    const metric = (id, title) => ({ id, type: 'metricCard', layout: { span: 6 }, data: { main: 'sample' }, props: { title, rows: [{ label: '当月', valueField: 'value' }] } });
    window.runtimeFidelity = mountPdfRuntimeFixture(source, {
      id: 'pdf-runtime-fidelity', schemaVersion: '6.17', layoutForm: layout,
      dataSources: { sample: { fields: { name: { type: 'string', role: 'dimension' }, value: { type: 'number', role: 'measure' } }, source: { type: 'inline', rows: Array.from({ length: 12 }, (_, index) => ({ name: `${index + 1}月`, value: (index + 1) * 10 })) } } },
      sections: [
        { id: 'cover', container: 'plain', components: [{ id: 'header', type: 'reportHeader', layout: { span: 12 }, props: { title: '完整呈现回归', decoration: 'shortBar' } }] },
        { id: 'metrics', container: 'plain', components: [metric('short', '收入'), metric('long', '较长的指标名称用于检查同一行的指标卡内部行轨是否仍然保持对齐')] },
        { id: 'nested', container: 'card', components: [{ id: 'composite', type: 'compositeCard', layout: { span: 12 }, props: { title: '组合卡', components: [metric('child-a', '指标 A'), metric('child-b', '指标 B')] } }] },
        { id: 'charts', container: 'plain', components: ['bar-a', 'bar-b'].map(id => ({ id, type: 'barChart', layout: { span: 6 }, data: { main: 'sample' }, props: { title: id, categoryField: 'name', series: [{ field: 'value', label: '金额' }] } })) }
      ]
    });
    window.runtimeFacts = root => Array.from(root.querySelectorAll('[data-section-id]')).map(section => {
      const origin = section.getBoundingClientRect();
      const box = element => { const rect = element.getBoundingClientRect(); return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height }; };
      return { id: section.dataset.sectionId, cells: Array.from(section.querySelectorAll('.cell,.metric-card,.composite-grid,.slot,.echart,.report-cover,.header-flow-background,h1')).map(box) };
    });
    document.addEventListener('load', event => {
      const frame = event.target;
      if (frame instanceof HTMLIFrameElement && frame.hasAttribute('data-report-pdf-frame')) window.runtimeCopied = window.runtimeFacts(frame.contentDocument.querySelector('[data-export-view]'));
    }, true);
  }, { width, layout });
  await expect(page.locator('#runtime-fidelity [data-section-id="charts"] canvas')).toHaveCount(2);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.locator('#runtime-fidelity').screenshot({ path: path.join(output, 'screen.png') });
  const download = page.waitForEvent('download');
  const result = await page.evaluate(async () => {
    const screen = window.runtimeFacts(document.querySelector('#runtime-fidelity'));
    let prepared;
    const pdf = await window.runtimeFidelity.export(view => { prepared = window.runtimeFacts(view); });
    return { screen, prepared, copied: window.runtimeCopied, pdf };
  });
  await (await download).saveAs(path.join(output, 'runtime.pdf'));
  await writeFile(path.join(output, 'runtime.json'), JSON.stringify({ ...result, errors }, null, 2));
  const sameBoxes = (actual, expected) => {
    expect(actual).toHaveLength(expected.length);
    for (const [index, box] of actual.entries()) for (const key of ['left', 'top', 'width', 'height']) {
      // Computed CSS decimal serialization can lose a subpixel; no visible geometry drift is allowed.
      expect(Math.abs(box[key] - expected[index][key])).toBeLessThanOrEqual(0.5);
    }
  };
  expect(result.copied.map(section => section.id)).toEqual(result.prepared.map(section => section.id));
  result.copied.forEach((section, index) => sameBoxes(section.cells, result.prepared[index].cells));
  for (const id of ['cover', 'metrics', 'nested', 'charts']) {
    const screen = result.screen.find(section => section.id === id);
    const prepared = result.prepared.find(section => section.id === id);
    // The supported action adds a 60px toolbar to the live header; export omits it.
    if(id==='cover'){
      const toolbarHeight=await page.locator('#runtime-fidelity [data-report-toolbar]').evaluate(el=>el.getBoundingClientRect().height);
      const adjusted=screen.cells.map((box,index)=>({...box,top:index?box.top-toolbarHeight:box.top,height:index?box.height:box.height-toolbarHeight}));
      sameBoxes(prepared.cells,adjusted);
    } else sameBoxes(prepared.cells, screen.cells);
  }
  if (width > 1050) expect(result.prepared.find(section => section.id === 'metrics').cells[0].top).toBe(result.prepared.find(section => section.id === 'metrics').cells[2].top);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ status: 'pass', pages: result.pdf.pageCount, sections: result.prepared.length }));
} finally { await page.evaluate(() => window.runtimeFidelity?.dispose()); await browser.close(); }
