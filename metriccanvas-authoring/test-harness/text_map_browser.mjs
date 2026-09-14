// Usage: node text_map_browser.mjs <public-tool-page.json> <evidence-directory>
// Build the current worktree's packages/embed before running this harness.
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../packages/embed/package.json', import.meta.url))('@playwright/test');
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const document = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = resolve(process.argv[3]); await mkdir(output, {recursive:true});
const runtime = await readFile(new URL('../../packages/embed/dist/metriccanvas-runtime.global.js', import.meta.url));
const server = createServer((request,response)=>{
  response.setHeader('Content-Type',request.url==='/runtime.js'?'text/javascript':'text/html');
  response.end(request.url==='/runtime.js'?runtime:'<!doctype html><html><meta charset="utf-8"><style>body{margin:24px}#app{max-width:1200px;margin:auto}</style><div id="app"></div><script src="/runtime.js"></script></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(document=>{window.runtime=MetricCanvas.mount('#app',{document});},document);
 const text=page.locator('[data-component-type="text"]');
 const field=page.locator('[data-component-type="fieldText"]');
 const map=page.locator('[data-component-type="mapChart"]');
 await field.waitFor();await map.locator('canvas').first().waitFor({timeout:5000}).catch(async e=>{console.error(await map.innerHTML(), await map.boundingBox(), errors);await page.screenshot({path:resolve(output,'failed.png'),fullPage:true});throw e;});
 assert.match(await text.innerText(),/增长保持稳定/);
 assert.match(await field.innerText(),/关键里程碑/);
 await page.waitForTimeout(350);
 const painted=await map.locator('canvas').first().evaluate(canvas=>{
   const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let count=0;for(let i=3;i<data.length;i+=4)if(data[i])count++;
   return count;
 });
 assert.ok(painted>10000,'map canvas must contain painted geometry');
 // Hover the actual rendered map and require a real regional data tooltip.
 const canvas=map.locator('canvas').first();const bounds=await canvas.boundingBox();
 let tooltip='';
 for(let y=0.25;y<0.8 && !tooltip;y+=0.04) {
  for(let x=0.5;x<0.9 && !tooltip;x+=0.03) {
   await page.mouse.move(bounds.x+bounds.width*x,bounds.y+bounds.height*y);
   await page.waitForTimeout(25);
   const body=await map.innerText();
   if(/上海市|浙江省/.test(body) && /42|18/.test(body))tooltip=body;
  }
 }
 assert.ok(tooltip,'real map tooltip must contain a bound region and numeric value');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:resolve(output,'text-map-report.png'),fullPage:true});
 console.log(JSON.stringify({ok:true,layout:document.layout,text:true,fieldText:true,mapTooltip:tooltip,errors}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
