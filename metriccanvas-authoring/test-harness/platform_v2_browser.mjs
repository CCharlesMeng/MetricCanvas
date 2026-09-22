// Render an actual v2 program artifact with the built product runtime.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const {chromium,expect}=createRequire(new URL('../../packages/embed/package.json',import.meta.url))('@playwright/test');
const root=resolve(import.meta.dirname,'../..');
const artifact=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));
const output=resolve(process.argv[3]);await mkdir(output,{recursive:true});
const runtime=await readFile(resolve(root,'packages/embed/dist/metriccanvas-runtime.global.js'));
const server=createServer((req,res)=>{
 if(req.url==='/runtime.js'){res.setHeader('Content-Type','text/javascript');res.end(runtime);}
 else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f5f6f8}#app{margin:auto}</style><div id="app"></div><script src="/runtime.js"></script>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[],measurements=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [1440,640]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(({document,width})=>{
   window.document.querySelector('#app').style.width=width+'px';
   window.runtime=MetricCanvas.mount('#app',{document,dataGateway:{fetchData:async()=>{throw new Error('Preview must use matching initial rows');}}});
  },{document:artifact.previewJson,width});
  await expect(page.locator('.page-content')).toBeVisible();
  await expect(page.locator('.cell[data-component-type="barChart"] canvas,.cell[data-component-type="barChart"] svg').first()).toBeVisible();
  await expect(page.locator('.cell[data-component-type="table"]')).toContainText('华东');
  const geometry=await page.locator('.page-content').evaluate(el=>{
   const parent=el.getBoundingClientRect();return {left:parent.left,right:parent.right,
    cells:[...el.querySelectorAll('.section-grid > .cell')].map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})};
  });
  assert.ok(geometry.cells.every(c=>c.left>=geometry.left-1&&c.right<=geometry.right+1&&c.height>0));
  for(let i=0;i<geometry.cells.length;i++)for(let j=i+1;j<geometry.cells.length;j++){
   const a=geometry.cells[i],b=geometry.cells[j];
   assert.ok(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1,'non-overlapping top-level cells');
  }
  await page.screenshot({path:resolve(output,`report-${width}.png`),fullPage:true});
  measurements.push({width,geometry});await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'render-report.json'),JSON.stringify({ok:true,evidenceKind:'real-runtime-local-fixture',measurements,errors},null,2));
 console.log(JSON.stringify({ok:true,viewports:measurements.map(m=>m.width),errors}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
