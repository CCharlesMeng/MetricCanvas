import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base=process.env.REPORT_PDF_BASE_URL??'http://127.0.0.1:5173';
const output=process.argv[2]??'/tmp/metriccanvas-pdf-performance';await mkdir(output,{recursive:true});
const input=JSON.parse(await readFile(new URL('../../../pages/business/report/sdt/commercial-sdt-efficiency-ultimate-monthly.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,channel:process.env.REPORT_PDF_CHANNEL??'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const results=[];
try {
  await page.goto(`${base}/preview?prototype=report-date`);await page.locator('.echart canvas').first().waitFor();
  await page.evaluate(async input=>{
    const {mountPdfRuntimeFixture}=await import('/tests/report-pdf-runtime-fixture.ts');
    const host=document.createElement('div');host.id='performance-sdt';host.style.width='1200px';document.body.append(host);
    window.performanceFixture=mountPdfRuntimeFixture(host,input,{async fetchData(_query,context){
      const id=context.dataSourceIds[0],fields=input.dataSources[id].fields;
      const rows=Array.from({length:id.includes('trend')?6:10},(_,index)=>Object.fromEntries(Object.entries(fields).map(([name,field])=>[name,field.type==='number'||field.type==='money'?Number(((index+1)*0.51).toFixed(2)):name==='time'?`2026-${String(index+5).padStart(2,'0')}`:`${field.label??name} ${index+1}`])));
      return {rows,totalCount:rows.length};
    }});
  },input);
  await page.locator('#performance-sdt canvas').first().waitFor();
  for(let run=0;run<3;run++){
    const downloaded=page.waitForEvent('download');
    const result=await page.evaluate(async()=>{
      const tasks=[],gaps=[];let previous=performance.now();
      const timer=setInterval(()=>{const now=performance.now();gaps.push(now-previous);previous=now;},16);
      const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});
      const started=performance.now();let rows;
      try {
        const pdf=await window.performanceFixture.export(view=>rows=view.querySelectorAll('tbody tr').length);
        const elapsedMs=performance.now()-started;await new Promise(resolve=>setTimeout(resolve,50));
        const sorted=gaps.sort((a,b)=>a-b);
        return {...pdf,rows,elapsedMs,maxLongTaskMs:Math.max(0,...tasks),heartbeatP95Ms:sorted[Math.floor((sorted.length-1)*0.95)]??0,maxHeartbeatMs:Math.max(0,...gaps)};
      }finally{clearInterval(timer);observer.disconnect();}
    });
    const download=await downloaded;if(run===0)await download.saveAs(path.join(output,'sdt.pdf'));
    expect(result.rows).toBe(50);expect(result.pageCount).toBe(3);
    expect(result.maxLongTaskMs).toBeLessThan(100);expect(result.heartbeatP95Ms).toBeLessThan(100);expect(result.maxHeartbeatMs).toBeLessThan(100);
    results.push(result);
  }
  await expect(page.locator('[data-report-pdf-frame],[data-metriccanvas-export-stage],.html2canvas-container')).toHaveCount(0);
  await writeFile(path.join(output,'result.json'),JSON.stringify({channel:process.env.REPORT_PDF_CHANNEL??'chrome',results},null,2));
  console.log(JSON.stringify({status:'pass',results}));
}finally{await browser.close();}
