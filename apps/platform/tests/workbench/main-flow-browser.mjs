import { createServer } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const repoRoot=resolve(appRoot,'../..');
const artifact=resolve(process.argv[2]);
const output=resolve(process.argv[3]);
const python=process.env.METRICCANVAS_AUTHORING_PYTHON || resolve(repoRoot,'metriccanvas-authoring/tool/.venv/bin/python');
const fixture=resolve(repoRoot,'metriccanvas-authoring/test-harness/fixtures/platform-main-flow.json');
const httpServer=resolve(repoRoot,'metriccanvas-authoring/test-harness/model-evals/main_flow_http.py');
await mkdir(output,{recursive:true});
const ready=resolve(output,'http-ready.json');
const httpLog=resolve(output,'browser-http.jsonl');
let child;
let vite;
let browser;
try {
child=spawn(python,[httpServer,'--fixture',fixture,'--log',httpLog,'--seed',artifact,'--ready',ready],{
  cwd:repoRoot,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'}
});
let childError='';child.stderr.on('data',chunk=>childError+=String(chunk));
for(let i=0;i<100&&!existsSync(ready);i++)await new Promise(resolve=>setTimeout(resolve,50));
if(!existsSync(ready))throw new Error(`Main-flow HTTP server did not start: ${childError}`);
const {baseUrl}=JSON.parse(await readFile(ready,'utf8'));
// The SvelteKit plugin resolves svelte.config.js and src/app.html from cwd.
// Keep the browser acceptance isolated from the repository's HTTPS dev config
// while presenting the actual Platform application as the Vite root.
process.chdir(appRoot);
vite=await createServer({root:appRoot,configFile:false,plugins:[sveltekit()],
  server:{host:'127.0.0.1',port:0,strictPort:false}});
await vite.listen();
const platformUrl=vite.resolvedUrls?.local?.[0];
if(!platformUrl)throw new Error('Platform Vite URL unavailable');
browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(({baseUrl})=>{window.__METRICCANVAS__={
  dqeEndpoint:`${baseUrl}/dsl/execute`,pageMetadataBaseUrl:baseUrl,
  authToken:'test-only',operatorId:'alice',workspaceId:'w'
};},{baseUrl});
const measurements=[];
  for(const width of [1440,640]){
    await page.setViewportSize({width,height:1000});
    await page.goto(`${platformUrl}?page=main-flow-report&resource=resource-main-flow-report`);
    await expect(page.getByText('2026年8月区域运营复盘',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('华东',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('华南',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('18',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('12',{exact:true}).first()).toBeVisible();
    await expect(page.locator('.bar-chart canvas').first()).toBeVisible();
    await page.waitForTimeout(1800);
    const content=page.locator('.page-content').first();
    await expect(content).toBeVisible();
    await page.screenshot({path:resolve(output,`main-flow-${width}.png`),fullPage:true});
    const geometry=await content.evaluate(element=>{
      const parent=element.getBoundingClientRect();
      return {left:parent.left,right:parent.right,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,
        cells:[...element.querySelectorAll('.section-grid > .cell')].map(cell=>{const rect=cell.getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,height:rect.height};})};
    });
    if(geometry.scrollWidth>geometry.clientWidth+1)throw new Error(`Page content overflows at ${width}px: ${JSON.stringify(geometry)}`);
    for(const cell of geometry.cells){if(cell.left<geometry.left-1||cell.right>geometry.right+1||cell.height<=0)throw new Error(`Invalid cell geometry at ${width}px`);}
    for(let i=0;i<geometry.cells.length;i++)for(let j=i+1;j<geometry.cells.length;j++){
      const a=geometry.cells[i],b=geometry.cells[j];
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)throw new Error(`Overlapping cells at ${width}px`);
    }
    measurements.push({width,geometry});
  }
  if(errors.length)throw new Error(`Browser page errors: ${errors.join('; ')}`);
  const exchanges=(await readFile(httpLog,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  if(!exchanges.some(exchange=>exchange.path.endsWith('/dsl/execute')))throw new Error('Saved document did not execute DQE after reopen');
  const result={ok:true,pageId:'main-flow-report',baseUrl:'local-http-fixture',viewports:measurements.map(item=>item.width),
    dqeCalls:exchanges.filter(exchange=>exchange.path.endsWith('/dsl/execute')).length,measurements,errors};
  await writeFile(resolve(output,'browser-report.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({ok:true,viewports:result.viewports,dqeCalls:result.dqeCalls}));
} finally {
  if(browser)await browser.close();
  if(vite)await vite.close();
  if(child){
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);
  }
}
