import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
const base=process.env.REPORT_PDF_BASE_URL??'http://127.0.0.1:5173';
const output=process.argv[2]??'/tmp/metriccanvas-report-pdf';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(`${base}/preview?prototype=report-date`);
  await page.locator('.echart canvas').first().waitFor();
  const input=JSON.parse(await readFile(new URL('../../../pages/report-pdf-export.json',import.meta.url),'utf8'));
  input.dataSources.sales.source.rows=Array.from({length:500},(_,index)=>({region:`项目 ${index+1}`,amount:index+1}));
  await page.evaluate(async input=>{
    const {mountPdfRuntimeFixture}=await import('/tests/report-pdf-runtime-fixture.ts');
    const host=document.createElement('div');host.id='pdf-long';host.style.width='900px';document.body.append(host);
    window.pdfRuntime=mountPdfRuntimeFixture(host,input);
    window.pdfBitmaps=[];const original=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message,...args){
      if(message.kind==='bitmap')window.pdfBitmaps.push({width:message.bitmap.width,height:message.bitmap.height,transfer:args[0]?.length});
      return original.call(this,message,...args);
    };
  },input);
  await page.locator('#pdf-long [data-report-pdf-download]').first().waitFor();
  let download=page.waitForEvent('download');
  const facts=await page.evaluate(async()=>{
    let rows=0;const tasks=[];const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});
    const started=performance.now();
    const result=await window.pdfRuntime.export(view=>rows=view.querySelectorAll('tbody tr').length);
    const elapsedMs=performance.now()-started;await new Promise(resolve=>setTimeout(resolve,50));observer.disconnect();
    return {...result,rows,elapsedMs,maxLongTaskMs:Math.max(0,...tasks),bitmaps:window.pdfBitmaps};
  });
  await(await download).saveAs(path.join(output,'long-report.pdf'));
  expect(facts.rows).toBe(500);expect(facts.maxLongTaskMs).toBeLessThan(100);expect(facts.pageCount).toBeGreaterThan(5);expect(facts.bitmaps.length).toBeGreaterThan(1);
  for(const bitmap of facts.bitmaps){expect(bitmap.width).toBeLessThanOrEqual(8192);expect(bitmap.height).toBeLessThanOrEqual(8192);expect(bitmap.width*bitmap.height).toBeLessThanOrEqual(16_777_216);expect(bitmap.transfer).toBe(1);}
  await expect(page.locator('[data-report-pdf-frame],[data-metriccanvas-export-stage],.html2canvas-container,[data-report-pdf-cancel]')).toHaveCount(0);
  download=page.waitForEvent('download');await page.evaluate(()=>window.pdfRuntime.export(()=>{}));await download;
  // Failure at the real Worker seam must allow retry and leave no partial download/DOM.
  await page.evaluate(()=>{window.OriginalWorker=window.Worker;window.Worker=class extends Worker{constructor(){throw Error('WORKER_BLOCKED_TEST');}};});
  await page.locator('#pdf-long [data-report-pdf-download]').first().click();
  await expect(page.locator('#pdf-long [data-report-pdf-download]').first()).toHaveAttribute('title',/WORKER_BLOCKED_TEST/);
  await expect(page.locator('[data-report-pdf-frame],[data-metriccanvas-export-stage],.html2canvas-container')).toHaveCount(0);
  await page.evaluate(()=>{window.Worker=window.OriginalWorker;});
  const preAborted=await page.evaluate(async()=>{
    const {downloadReportPdf}=await import('/src/lib/report-pdf-client.ts');const controller=new AbortController();controller.abort(Error('instance disposed'));
    try{await downloadReportPdf(document.body,controller.signal);}catch(error){return error.message;}
  });expect(preAborted).toBe('instance disposed');
  expect(errors).toEqual([]);
  await writeFile(path.join(output,'result.json'),JSON.stringify(facts,null,2));
  console.log(JSON.stringify({status:'pass',...facts}));
}finally{await browser.close();}
