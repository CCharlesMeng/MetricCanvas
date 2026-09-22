import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url)).replace(/\/$/, '');
const fixture=JSON.parse(readFileSync(new URL('../../../../docs/archive/authoring-tickets-126/t04-contract-examples.json',import.meta.url),'utf8')).cases.find(c=>c.id==='execute-success').steps[0];
const harness=`<script>import Preview from '/src/lib/RevisionPreview.svelte';let id=$state('r1');let shown=$state(true);export function change(next){id=next}export function remove(){shown=false}</script>{#if shown}<Preview pageId="t04-example" revisionId={id} readRevision={window.readRevision} executeRevision={window.executeRevision}/>{/if}`;
const entry=`import {mount} from 'svelte';import Harness from '/__harness.svelte';import {prepareExecution} from '@metriccanvas/engine';import {normalizePageDocument} from '@metriccanvas/page';
const fixture=${JSON.stringify(fixture)};
window.pending={};window.signals={};window.calls=[];window.documents={};
const deferred=(key,signal)=>{window.calls.push(key);window.signals[key]=signal;return new Promise(resolve=>window.pending[key]=resolve)};
window.readRevision=(pageId,revisionId,signal)=>deferred('read:'+revisionId,signal);
window.executeRevision=new URLSearchParams(location.search).has('plain')?undefined:(revision,signal)=>deferred('execute:'+revision.revisionId,signal);
window.resolveRead=id=>{const document=structuredClone(fixture.response.document);document.params=[{id:'heading',type:'string',required:true,default:'READ-'+id}];document.sections[0].components[0].props.title={param:'heading'};for(const [key,ds] of Object.entries(document.dataSources)){ds.source.initial={capturedAt:'2026-09-14T00:00:00Z',rows:fixture.response.dataSources[key].rows};}window.documents[id]=structuredClone(document);window.pending['read:'+id]({pageId:'t04-example',revisionId:id,resourceId:'metadata-a',revisionNumber:1,document,baseRevisionId:null,contentHash:'fixture',dataContextVersion:null,createdBy:'fixture',createdAt:'2026-09-14'});};
window.resolveExecution=(id,wrong=false,changed=false)=>{const request=structuredClone(fixture.request);request.target.ref.revisionId=wrong?'wrong':id;request.operationId='execute-'+id;const response=structuredClone(fixture.response);response.target=request.target;response.operationId=request.operationId;response.document=normalizePageDocument(window.documents[id]).document;response.appliedInputs={heading:'EXEC-'+id};if(changed)response.document.sections[0].components[1].props.title='REPLACED-DOCUMENT';window.pending['execute:'+id](prepareExecution(request,response));};
window.controls=mount(Harness,{target:document.getElementById('app')});`;
const server=await createServer({root,cacheDir:'/private/tmp/s2-t18-preview-vite',configFile:false,plugins:[{
  name:'execution-preview-fixture',
  resolveId(id){if(id==='/__entry.js')return '\0entry';if(id==='/__harness.svelte')return root+'/__harness.svelte';},
  load(id){if(id==='\0entry')return entry;if(id===root+'/__harness.svelte')return harness;},
  configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url==='/'||req.url?.startsWith('/?')){res.setHeader('Content-Type','text/html');res.end('<div id="app"></div><script type="module" src="/__entry.js"></script>');}else next();});}
},svelte()],server:{host:'127.0.0.1',port:5184,strictPort:true,fs:{allow:[fileURLToPath(new URL('../../../..',import.meta.url))]}}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const pending=key=>expect.poll(()=>page.evaluate(key=>Boolean(window.pending?.[key]),key)).toBe(true);
try{
 await page.goto('http://127.0.0.1:5184/');await pending('read:r1');await page.evaluate(()=>window.resolveRead('r1'));await pending('execute:r1');
 await page.evaluate(()=>window.controls.change('r2'));await pending('read:r2');expect(await page.evaluate(()=>window.signals['execute:r1'].aborted)).toBe(true);
 await page.evaluate(()=>window.resolveRead('r2'));await pending('execute:r2');await page.evaluate(()=>window.resolveExecution('r2'));await expect(page.getByText('EXEC-r2',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.resolveExecution('r1'));await expect(page.getByText('EXEC-r2',{exact:true})).toBeVisible();await expect(page.getByText('EXEC-r1',{exact:true})).toHaveCount(0);
 await page.evaluate(()=>window.controls.change('r3'));await pending('read:r3');await page.evaluate(()=>window.controls.change('r4'));await pending('read:r4');
 expect(await page.evaluate(()=>window.signals['read:r3'].aborted)).toBe(true);await page.evaluate(()=>window.resolveRead('r3'));
 expect(await page.evaluate(()=>window.calls.includes('execute:r3'))).toBe(false);
 await page.evaluate(()=>window.resolveRead('r4'));await pending('execute:r4');await page.evaluate(()=>window.resolveExecution('r4',true));await expect(page.getByRole('alert')).toContainText('执行预览与已读精确修订不匹配');
 await page.evaluate(()=>window.controls.change('r5'));await pending('read:r5');await page.evaluate(()=>window.resolveRead('r5'));await pending('execute:r5');await page.evaluate(()=>window.controls.remove());
 expect(await page.evaluate(()=>window.signals['execute:r5'].aborted)).toBe(true);await page.evaluate(()=>window.resolveExecution('r5'));await expect(page.getByText('EXEC-r5',{exact:true})).toHaveCount(0);
 await page.goto('http://127.0.0.1:5184/');await pending('read:r1');await page.evaluate(()=>window.resolveRead('r1'));await pending('execute:r1');await page.evaluate(()=>window.resolveExecution('r1',false,true));
 await expect(page.getByRole('alert')).toContainText('执行预览文档与已读精确修订不匹配');await expect(page.getByText('REPLACED-DOCUMENT',{exact:true})).toHaveCount(0);await expect(page.getByLabel('精确修订预览 r1')).toBeVisible();
 await page.goto('http://127.0.0.1:5184/?plain=1');await pending('read:r1');await page.evaluate(()=>window.resolveRead('r1'));await expect(page.getByText('READ-r1',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.calls.some(k=>k.startsWith('execute:')))).toBe(false);expect(errors).toEqual([]);
 console.log('RevisionPreview: exact read→execution, abort/late isolation, mismatched target/document, parameter initialization with compatible normalization, unmount and no-executor fallback passed');
}finally{await browser.close();await server.close();}
