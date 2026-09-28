import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium,expect} from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
const qiankun=process.env.QIANKUN_DIST || createRequire(import.meta.url).resolve('qiankun/dist/index.umd.js');
const dist=resolve('apps/platform/dist/microfrontend');
const host=`<!doctype html><title>Portal title</title><style>html,body{height:100%;margin:0}#container{height:850px}</style><header id="portal">Test portal</header><div id="container"></div><script src="/qiankun.js"></script><script>
window.events=[];window.subscribers=new Set();window.config={dqeEndpoint:'',pageMetadataBaseUrl:'/fixture-assets',authToken:'fixture',operatorId:'test-user',workspaceId:'test-workspace'};
window.go=async(path)=>{if(window.guard && !await window.guard())return false;history.pushState({},'',path);return true;};
qiankun.registerMicroApps([{name:'metriccanvas',entry:'/release/index.html',container:'#container',activeRule:location=>location.pathname==='/metrics'||location.pathname.startsWith('/metrics/'),props:{routeBase:'/metrics',readConfig:()=>window.config,subscribeConfig:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn)},onEvent:event=>events.push(event),registerLeaveGuard:fn=>{window.guard=fn;return()=>{window.guard=undefined}}}}]);
window.addEventListener('single-spa:before-routing-event',event=>{
 const before=new URL(event.detail.oldUrl),after=new URL(event.detail.newUrl);
 const inside=url=>url.pathname==='/metrics'||url.pathname.startsWith('/metrics/');
 if(inside(before)&&!inside(after)&&window.guard&&window.guard()===false)event.detail.cancelNavigation();
});
qiankun.start({prefetch:false,sandbox:true});</script>`;
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://local').pathname;let body;
 try {
  if(path==='/qiankun.js')body=readFileSync(qiankun);
  else if(path.startsWith('/release/'))body=readFileSync(resolve(dist,path.slice('/release/'.length)));
  else if(path.startsWith('/fixture-assets')){res.writeHead(503);res.end();return;}
  else if(extname(path)){res.writeHead(404);res.end();return;}
  else body=host;
 }catch{res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(body);
});
await new Promise(r=>server.listen(5198,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let doc={schemaVersion:'6.5',layout:'report',id:'asset-test',dataSources:{},sections:[{id:'main',components:[{id:'text',type:'text',layout:{span:12},props:{title:'原始标题',body:'页面内容'}}]}]};
let revision=1,isDraft=true,writes=0,delayWrite=false;const tokens=[];
const receipt=()=>({retCode:'CBC.0000',page_id:doc.id,page_metadata_id:'metadata-1',revision_id:`r${revision}`,revision_number:revision,is_draft:isDraft,page_metadata_definition:JSON.stringify(doc)});
try {
 await page.route('**/fixture-assets/user-page-metadata**',async route=>{
  const req=route.request();tokens.push(req.headers()['x-auth-token']);
  if(req.url().endsWith('/history'))return route.fulfill({json:{retCode:'CBC.0000',history_list:[]}});
  if(req.method()==='PUT'){const body=req.postDataJSON();doc=body.page_metadata_definition;isDraft=body.is_draft;revision++;writes++;if(delayWrite)await new Promise(r=>setTimeout(r,1500));}
  await route.fulfill({json:req.url().includes('?')?{retCode:'CBC.0000',total:1,page_metadata_list:[receipt()]}:receipt()}).catch(()=>{});
 });
 await page.goto('http://127.0.0.1:5198/metrics/manage');
 await expect(page.getByRole('link',{name:/asset-test/})).toBeVisible();
 expect(await page.title()).toBe('Portal title');
 expect(await page.locator('[data-testid="platform-app"]').evaluate(el=>getComputedStyle(el).display)).toBe('grid');
 await page.getByRole('link',{name:/asset-test/}).click();
 await expect(page.getByRole('heading',{name:'当前读取内容预览'})).toBeVisible();
 await page.goBack();await expect(page).toHaveURL(/\/metrics\/manage$/);
 await page.goForward();await expect(page).toHaveURL(/\/metrics\/manage\/pages\/asset-test\?resource=metadata-1$/);
 await page.reload();await expect(page.getByRole('heading',{name:'当前读取内容预览'})).toBeVisible();
 await page.getByRole('link',{name:'编辑当前页面'}).click();
 const inspector=page.getByRole('complementary',{name:'检查器'});
 await expect(page.getByTestId('chat-unavailable')).toBeVisible();
 const portalOverflow=await page.locator('body').evaluate(el=>el.style.overflow);
 await page.getByRole('button',{name:'查看元数据',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.locator('body').evaluate(el=>el.style.overflow)).toBe(portalOverflow);
 expect(await page.locator('#portal').evaluate(el=>el.inert)).toBe(false);
 await page.getByRole('button',{name:'关闭 metadata.json'}).click();
 await inspector.getByRole('button',{name:/原始标题/}).click();
 await inspector.getByLabel('组件标题').fill('修改后的标题');await inspector.getByLabel('组件标题').press('Tab');
 await expect.poll(()=>writes).toBe(1);await expect(page.getByText('服务端已保存修订 R2')).toBeVisible();
 expect(await page.evaluate(()=>events.filter(e=>e.code==='ready').length)).toBe(1);
 await page.evaluate(()=>{config={...config,authToken:'rotated'};for(const fn of subscribers)fn();});
 await page.getByRole('link',{name:'页面历史',exact:true}).click();await expect(page.getByRole('heading',{name:'当前读取内容预览'})).toBeVisible();
 expect(tokens.at(-1)).toBe('rotated');
 await page.getByRole('link',{name:'编辑当前页面'}).click();
 await inspector.getByRole('button',{name:/修改后的标题/}).click();
 delayWrite=true;
 await inspector.getByLabel('组件标题').fill('未确认的标题');await inspector.getByLabel('组件标题').press('Tab');
 await expect.poll(()=>writes).toBe(2);
 page.on('dialog',dialog=>dialog.dismiss());
 const protectedUrl=page.url();
 await page.getByRole('link',{name:'页面管理',exact:true}).click();expect(page.url()).toBe(protectedUrl);
 await page.goBack();await expect(page).toHaveURL(protectedUrl);await expect(inspector).toBeVisible();
 expect(await page.evaluate(()=>go('/outside'))).toBe(false);
 await expect(page.getByText('服务端已保存修订 R3')).toBeVisible();
 await page.evaluate(()=>go('/outside'));await expect(page.locator('[data-testid="platform-app"]')).toHaveCount(0);
 expect(await page.evaluate(()=>subscribers.size)).toBe(0);expect(await page.locator('#portal').innerText()).toBe('Test portal');
 await page.evaluate(()=>go('/metrics/manage'));await expect(page.getByRole('link',{name:/asset-test/})).toBeVisible();
 await page.evaluate(()=>{config={...config,operatorId:'other-user'};for(const fn of [...subscribers])fn();});
 await expect(page.getByRole('alert')).toContainText('身份或服务目标已变化');
 expect(await page.evaluate(()=>events.filter(e=>e.code==='session-invalidated').length)).toBe(1);
 await page.evaluate(()=>go('/metrics-other'));await expect(page.locator('[data-testid="platform-app"]')).toHaveCount(0);
 await page.evaluate(async()=>{await go('/metrics/manage');await go('/outside');await go('/metrics/manage');});
 await expect(page.getByRole('link',{name:/asset-test/})).toBeVisible();
 expect(await page.locator('[data-testid="platform-app"]').count()).toBe(1);
 // Browser back across the prefix is protected by the portal's guard bridge.
 await page.goto('http://127.0.0.1:5198/outside');
 await page.evaluate(()=>go('/metrics/?page=asset-test&resource=metadata-1'));
 await inspector.getByRole('button',{name:/未确认的标题/}).click();
 delayWrite=true;
 await inspector.getByLabel('组件标题').fill('跨区域后退保护');await inspector.getByLabel('组件标题').press('Tab');
 await expect.poll(()=>writes).toBe(3);
 const crossingUrl=page.url();await page.goBack();await expect(page).toHaveURL(crossingUrl);
 await expect(inspector).toBeVisible();
 await expect(page.getByText('服务端已保存修订 R4')).toBeVisible();
 // Already submitted writes cannot be rolled back; original durable command must survive logout.
 await inspector.getByLabel('组件标题').fill('发送后退出');await inspector.getByLabel('组件标题').press('Tab');
 await expect.poll(()=>writes).toBe(4);
 await page.evaluate(()=>{config=null;for(const fn of [...subscribers])fn();});
 await expect(page.getByRole('alert')).toContainText('身份或服务目标已变化');
 await page.goto('http://127.0.0.1:5198/metrics/?page=asset-test&resource=metadata-1');
 await expect(inspector).toBeVisible();
 await expect(page.getByText(/原保存结果未确认|保存结果未确认|已停止重发/).first()).toBeVisible();
 expect(writes).toBe(4);
 await page.evaluate(()=>{config=null;for(const fn of [...subscribers])fn();});
 await page.evaluate(()=>go('/outside'));await expect(page.locator('[data-testid="platform-app"]')).toHaveCount(0);
 const failureCleanup=await page.evaluate(async()=>{
  let count=0;
  const element=document.createElement('div');element.style.height='700px';document.body.append(element);
  const bad=qiankun.loadMicroApp({name:'failure-probe',entry:'/release/index.html',container:element,props:{
    routeBase:'/metrics',readConfig:()=>null,subscribeConfig:()=>{count++;return()=>count--;},onEvent:()=>{throw Error('expected ready failure');}
  }},{sandbox:true});
  let failed=false;try{await bad.mountPromise;}catch{failed=true;}
  const result={failed,count,roots:element.querySelectorAll('[data-testid="platform-app"]').length};element.remove();return result;
 });
 expect(failureCleanup).toEqual({failed:true,count:0,roots:0});
 expect(errors).toEqual([]);
 console.log(JSON.stringify({status:'PASS',qiankun:'2.10.16',browser:browser.version(),writes,evidence:'production HTML + CSS/UMD, prefix, navigation/back/forward/refresh, manual edit/save/reopen, cancel click/back/cross-prefix back/portal leave, local modal, unknown write retained without replay, token refresh, identity invalidation, unmount/remount/rapid switching, failed mount cleanup; HTTP fixture only'}));
} catch(error){console.error(await page.locator('body').innerText());console.error(errors);throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
