import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const base=process.env.REPORT_PDF_BASE_URL??'http://127.0.0.1:5173';
const output=process.argv[2]??'/tmp/metriccanvas-pdf-partial';
await mkdir(output,{recursive:true});
const fixture=JSON.parse(await readFile(new URL('../../../packages/page/fixtures/contract-valid/report-date-filters-page.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900},acceptDownloads:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(`${base}/preview?prototype=report-date`);
  await page.locator('.echart canvas').first().waitFor();
  for(const scenario of ['failed-source','failed-later-page','refresh-failed','all-failed']) {
    await page.evaluate(async({fixture,scenario})=>{
      const {mountPdfRuntimeFixture}=await import('/tests/report-pdf-runtime-fixture.ts');
      const host=document.createElement('div');host.id='partial-fixture';host.style.width='1100px';document.body.append(host);
      const documentInput=structuredClone(fixture);
      documentInput.schemaVersion='6.18';
      documentInput.dataSources.failed=structuredClone(documentInput.dataSources.sales);
      documentInput.dataSources.failed.source.query.body.dsl_list[0].filter.time.is_aggregate=true;
      const failed=structuredClone(documentInput.sections[1].components[0]);failed.id='failed-table';failed.data.main='failed';
      documentInput.sections[1].components.push(failed);
      documentInput.dataSources['failed-summary-source']=structuredClone(documentInput.dataSources.failed);
      documentInput.sections[1].components.push({id:'failed-summary',type:'aiSummary',layout:{span:12},props:{title:'总结',promptTemplate:'总结经营表现',relatedData:{failed:{source:'failed-summary-source',description:'未取得的数据',fields:[{field:'amount',term:'金额'}]}}}});
      window.partialDownloadStarted=false;
      window.partialFixture=mountPdfRuntimeFixture(host,documentInput,{async fetchData(query,context){
        if(scenario==='refresh-failed'&&window.partialDownloadStarted)throw new Error('simulated refresh failure');
        if(scenario==='all-failed'||context?.dataSourceIds?.some(id=>id.startsWith('failed')))throw new Error('simulated unavailable source');
        if(scenario==='failed-later-page'&&(query.pagination?.offset??0)>0)throw new Error('simulated later page failure');
        return {rows:Array.from({length:10},(_,i)=>({entry:`available-${i}`,amount:i+1})),totalCount:scenario==='failed-later-page'?23:10};
      }});
    },{fixture,scenario});
    await expect(page.locator('#partial-fixture h1')).toHaveText('经营分析报告');
    if(scenario!=='all-failed')await expect(page.locator('#partial-fixture').getByText('available-0',{exact:true})).toBeVisible();
    const download=page.waitForEvent('download');
    void download.catch(()=>{});
    const result=await page.evaluate(async()=>{
      let facts;
      window.partialDownloadStarted=true;
      const pdf=await window.partialFixture.export(view=>{
        facts={title:view.querySelector('h1')?.textContent,text:view.textContent,rows:view.querySelectorAll('[data-export-component="sales-table"] tbody tr').length,
          customErrors:view.querySelectorAll('[data-export-error]').length,controls:view.querySelectorAll('button,input,select').length};
      });
      return {...facts,...pdf,stages:document.querySelectorAll('[data-metriccanvas-export-stage]').length};
    });
    const file=path.join(output,`${scenario}.pdf`);await(await download).saveAs(file);
    expect((await readFile(file)).subarray(0,5).toString()).toBe('%PDF-');
    expect(result.title).toBe('经营分析报告');
    if(scenario!=='all-failed'){expect(result.rows).toBe(10);expect(result.text).toContain('available-9');}
    else expect(result.text).not.toContain('available-');
    expect(result.customErrors).toBe(0);expect(result.stages).toBe(0);expect(result.controls).toBe(0);
    await page.evaluate(async()=>{await window.partialFixture.dispose();document.querySelector('#partial-fixture').remove();});
    console.log(JSON.stringify({scenario,rows:result.rows,pages:result.pageCount,status:'pass'}));
  }
  expect(errors).toEqual([]);
}finally{await browser.close();}
