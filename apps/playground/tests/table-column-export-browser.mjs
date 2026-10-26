import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base=process.env.COLUMN_VISIBILITY_BASE_URL??'http://127.0.0.1:5197';
const output=process.argv[2]??'/tmp/mc-column-visibility-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
async function mode(label){await page.getByRole('button',{name:'列范围',exact:true}).click();await page.getByRole('option',{name:label,exact:true}).click();}
async function download(format){
 await mode('仅客户');
 const pending=page.waitForEvent('download',{timeout:65000});
 await page.getByRole('button',{name:`导出 ${format.toUpperCase()}`,exact:true}).click();
 // Input changes after the synchronous capture must not affect the in-flight view.
 await mode('完整列');
 const result=await pending,filename=path.join(output,`visible-columns.${format}`);
 await result.saveAs(filename);
 const bytes=await readFile(filename);
 expect(bytes.length).toBeGreaterThan(100);
 return bytes;
}
try{
 await page.goto(`${base}/pages/table-column-visibility-report`);
 await expect(page.getByRole('button',{name:'导出 PDF',exact:true})).toBeVisible();
 await page.evaluate(()=>{
  window.columnExportFacts=[];
  const OriginalWorker=window.Worker;
  window.Worker=class extends OriginalWorker{
   constructor(url,options){
    super(url,options);
    const view=document.querySelector('[data-report-export-frame]')?.contentDocument?.querySelector('[data-export-view]');
    if(view)window.columnExportFacts.push({headers:[...view.querySelectorAll('th')].map(node=>node.textContent.trim()),text:view.textContent});
   }
  };
 });
 const pdf=await download('pdf');expect(pdf.subarray(0,4).toString()).toBe('%PDF');
 const png=await download('png');expect(png.subarray(1,4).toString()).toBe('PNG');
 const facts=await page.evaluate(()=>window.columnExportFacts);
 expect(facts.length).toBeGreaterThanOrEqual(2);
 for(const fact of facts){expect(fact.headers).not.toContain('项目资料');expect(fact.headers).not.toContain('金额');expect(fact.headers).toContain('客户');}
 expect(errors).toEqual([]);
 await writeFile(path.join(output,'export-result.json'),JSON.stringify({errors,frozen: true,facts},null,2));
 console.log('PDF/PNG frozen column export passed');
}finally{await browser.close();}
