import {createRequire} from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
const build = resolve(process.env.KIT_BUILD || '/tmp/mc-kit-baseline');
const html = readFileSync(`${build}/index.html`, 'utf8');
const entries = [...html.matchAll(/import\("([^\"]+)"\)/g)].map(m => m[1]);
const marker = html.match(/(__sveltekit_\w+) =/)[1];
const qiankun = process.env.QIANKUN_DIST || createRequire(import.meta.url).resolve('qiankun/dist/index.umd.js');
const server = createServer((req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  let body;
  if (path === '/host') body = `<div id="portal">Portal survives</div><div id="container" style="height:800px"></div><script src="/qiankun.js"></script>`;
  else if (path === '/qiankun.js') body = readFileSync(qiankun);
  else if (path === '/raw.html') body = html;
  else if (path === '/adapted.html') body = `<div id="kit-root" style="height:800px"></div><script src="/adapter.js"></script>`;
  else if (path === '/native-start.js') body = `globalThis.${marker}={base:''};export async function start(target){const [kit,app]=await Promise.all(${JSON.stringify(entries)}.map(url=>import(url)));globalThis.probeExports=Object.keys(kit);globalThis.probeReturn=await kit.start(app,target);}`;
  else if (path === '/adapter.js') body = `window.kitProbe={bootstrap:async()=>{},mount:async(props)=>{await (await import('/native-start.js')).start(props.container.querySelector('#kit-root'));},unmount:async()=>{}};`;
  else {try {body=readFileSync(resolve(build,`.${path}`));} catch {res.writeHead(404);res.end();return;}}
  res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(body);
});
await new Promise(r=>server.listen(5199,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try {
 for (const mode of ['raw','adapted']) {
  const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5199/host');
  const result=await page.evaluate(async mode=>{
    history.replaceState({},'', '/manage');
    const active=new Map();const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
    window.addEventListener=(type,fn,opts)=>{if(!active.has(type))active.set(type,new Set());active.get(type).add(fn);return add(type,fn,opts);};
    window.removeEventListener=(type,fn,opts)=>{active.get(type)?.delete(fn);return remove(type,fn,opts);};
    const app=qiankun.loadMicroApp({name:'kitProbe',entry:`/${mode}.html`,container:'#container'},{sandbox:true});
    try {await app.mountPromise; const mounted=!!document.querySelector('[data-testid="platform-app"]');await app.unmount();return {mounted,exports:window.probeExports,startReturned:typeof window.probeReturn,listenersAfterUnmount:Object.fromEntries([...active].map(([type,fns])=>[type,fns.size])),remaining:!!document.querySelector('[data-testid="platform-app"]')};}
    catch(e){return {error:String(e)}};
  },mode);
  console.log(JSON.stringify({mode,...result,errors}));await page.close();
 }
} finally {await browser.close();await new Promise(r=>server.close(r));}
