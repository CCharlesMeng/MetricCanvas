// Bounded raw evidence collector; assertions live in the behavior suite.
import {createServer} from 'vite';
import {chromium} from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const root=resolve('packages/ui');
const out=resolve(process.env.UI_CAPTURE_OUT??'docs/evidence/platform-ui-management-2026-10-12/ui-boundaries');
await mkdir(out,{recursive:true});
const server=await createServer({root,configFile:resolve(root,'vite.config.ts'),server:{port:0}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:700}});
const states=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function capture(id){
 const facts=await page.evaluate(()=>{
  const root=document.getElementById('app')?.shadowRoot??document;
  const nodes=[...root.querySelectorAll('button[role="tab"],.mc-ui-dialog-box,.mc-ui-dialog-box__footer button,.mc-ui-grid .mc-ui-grid-cell,.mc-ui-select-dropdown,.mc-ui-select-dropdown__item,.mc-ui-pager .is-active,.empty')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height);
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},document:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth},nodes:nodes.map(el=>{const box=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,class:el.className,text:el.textContent?.slice(0,100),rect:{x:box.x,y:box.y,width:box.width,height:box.height},scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,style:{color:s.color,background:s.backgroundColor,cursor:s.cursor,fontWeight:s.fontWeight,outline:s.outline,boxShadow:s.boxShadow,overflow:s.overflow,textOverflow:s.textOverflow,whiteSpace:s.whiteSpace},disabled:el.hasAttribute('disabled'),selected:el.getAttribute('aria-selected'),focused:root.activeElement===el,shadow:el.getRootNode() instanceof ShadowRoot};})};
 });
 const screenshot=id+'.png';await page.screenshot({path:resolve(out,screenshot)});states.push({id,facts,screenshot});
}
try{
 for(const shadow of [false,true]){
  const query=shadow?'shadow&':'';
  await page.goto(server.resolvedUrls.local[0]+'tests/browser/index.html?'+query+'boundary=long');
  await page.getByRole('tab',{name:'选项一'}).focus();await capture(`long-focused-${shadow}`);
  await page.getByRole('tab',{name:'选项二'}).click();await capture(`selected-${shadow}`);
  await page.getByRole('button',{name:'选择',exact:true}).click();await capture(`select-open-${shadow}`);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'打开对话框'}).click();await capture(`dialog-open-${shadow}`);await page.keyboard.press('Escape');
  await page.goto(server.resolvedUrls.local[0]+'tests/browser/index.html?'+query+'boundary=empty');
  await capture(`empty-${shadow}`);
 }
 await writeFile(resolve(out,'raw.json'),JSON.stringify({browser:browser.version(),kind:'current Chrome, UI fixture',errors,states},null,2));
 console.log(JSON.stringify({browser:browser.version(),out,states:states.length,errors}));
}finally{await browser.close();await server.close();}
