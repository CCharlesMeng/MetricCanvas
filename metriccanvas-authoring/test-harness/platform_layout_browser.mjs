// Real browser verification of public stdio outputs, not model-routing evidence.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const {chromium,expect}=createRequire(new URL('../../packages/embed/package.json',import.meta.url))('@playwright/test');
const root=resolve(import.meta.dirname,'../..');const output=resolve(process.argv[2]);
const pages=resolve(output,'pages');await mkdir(pages,{recursive:true});
const execution=spawnSync(process.env.METRICCANVAS_TEST_PYTHON??'python3',['-m','unittest','discover','-s','metriccanvas-authoring/test-harness/tests','-p','test_platform_authoring_flows.py'],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',METRICCANVAS_LAYOUT_EVIDENCE_DIR:pages},encoding:'utf8'});
assert.equal(execution.status,0,execution.stderr);
const runtime=await readFile(resolve(root,'packages/embed/dist/metriccanvas-runtime.global.js'));
const server=createServer(async(req,res)=>{
 if(req.url==='/dqe'){
  let body='';for await(const chunk of req)body+=chunk;
  const request=JSON.parse(body);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({retCode:'CBC.0000',results:request.dsl_list.map(item=>({code:'SUCCESS',data:[Object.fromEntries([...item.output_dims.map(field=>[field,'华东']),...item.output_metrics.map(field=>[field,42])])],total_count:1}))}));
 }else if(req.url==='/runtime.js'){res.setHeader('Content-Type','text/javascript');res.end(runtime);}
 else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0}#app{margin:0 auto}</style><div id="app"></div><script src="/runtime.js"></script>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[];const measured=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const name of ['created-report','created-dashboard','edited-report','edited-dashboard','switched-to-report','switched-to-dashboard','backdrop-report','composed-report','composed-dashboard']){
  const document=JSON.parse(await readFile(resolve(pages,name+'.json'),'utf8'));
  for(const width of [1440,640]){
   const page=await browser.newPage({viewport:{width:1600,height:1200}});page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   await page.evaluate(({document,width})=>{document=structuredClone(document);window.document.querySelector('#app').style.width=width+'px';window.runtime=MetricCanvas.mount('#app',{document,dataGateway:MetricCanvas.createDqeGateway({endpoint:location.origin+'/dqe'})});},{document,width});
   await expect(page.locator('.page-content')).toBeVisible();
   if(name.startsWith('created')){
    await expect(page.locator('.cell[data-component-type="reportHeader"]').getByText('经营总览',{exact:true})).toBeVisible();await expect(page.getByText('业务说明',{exact:true})).toBeVisible();await expect(page.getByText('当前经营情况清晰。',{exact:true})).toBeVisible();
   }else if(name.startsWith('composed')){
    await expect(page.getByText('问数结果',{exact:true})).toBeVisible();
    await expect(page.getByText('各区域 Tokens 请求量',{exact:true})).toBeVisible();
    const chart=page.locator('.cell[data-component-type="barChart"]');
    await expect.poll(async()=>chart.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(270);
    await expect(chart.locator('canvas,svg').first()).toBeVisible();
   }else if(!name.startsWith('backdrop')){
    await expect(page.getByText('手工章节',{exact:true})).toBeVisible();await expect(page.locator('.cell[data-component-type="reportHeader"]').getByText('修改后页头',{exact:true})).toBeVisible();await expect(page.locator('[data-component="main/table"]')).toContainText('private-region');
   }
   const geometry=await page.locator('.page-content').evaluate(element=>{
    const root=element.getBoundingClientRect();
    const cells=[...element.querySelectorAll('.section-grid > .cell:not(.backdrop-cell)')].map(c=>{const r=c.getBoundingClientRect();return {x:r.x,width:r.width,right:r.right};});
    const backdrop=element.querySelector('.backdrop-cell');
    return {width:root.width,left:root.left,right:root.right,cells,backdropPosition:backdrop?getComputedStyle(backdrop).position:null,backdropHeight:backdrop?.getBoundingClientRect().height};
   });
   assert.ok(geometry.width<=width+1);
   if(document.layout==='dashboard')assert.ok(Math.abs(geometry.width-width)<1);
   else if(width===1440){assert.ok(geometry.width<width);assert.ok(Math.abs(geometry.left-(1600-geometry.width)/2)<1);}
   if(width===640){
    assert.ok(geometry.cells.every(c=>c.right<=geometry.right+1&&c.x>=geometry.left-1),'cells remain inside narrow container');
    const sameSection=await page.locator('[data-section-id="main"] .section-grid > .cell').evaluateAll(cs=>cs.map(c=>c.getBoundingClientRect().width));
    if(sameSection.length>1)assert.ok(Math.max(...sameSection)-Math.min(...sameSection)<2,'narrow cells span full grid');
   }
   if(name==='backdrop-report'){
    assert.equal(geometry.backdropPosition,width===640?'static':'absolute');assert.ok(geometry.backdropHeight>=320);
   }
   await page.screenshot({path:resolve(output,`${name}-${width}.png`),fullPage:true});measured.push({name,width,contentWidth:geometry.width});await page.close();
  }
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,scenarios:measured.length,containerWidths:[1440,640],measurements:measured,errors}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
