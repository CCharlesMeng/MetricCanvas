// Usage: METRICCANVAS_TEST_PYTHON=<python> node interaction_browser.mjs <evidence-dir>
// Build current packages/embed first. Only the external DQE boundary is local;
// the product's real gateway, filter state, href construction and browser navigation run.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const {chromium,expect}=createRequire(new URL('../../packages/embed/package.json',import.meta.url))('@playwright/test');
const root=resolve(import.meta.dirname,'../..');const output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
const runtime=await readFile(resolve(root,'packages/embed/dist/metriccanvas-runtime.global.js'));
const requests=[];const rows=[{raw_region:'上海市',gmv:42},{raw_region:'浙江省',gmv:18}];
const server=createServer(async(req,res)=>{
 if(req.url==='/dqe') {
  let body='';for await(const chunk of req)body+=chunk;
  const request=JSON.parse(body);requests.push(request);
  const results=request.dsl_list.map(item=>{
   if(item.output_metrics.length===0)return {code:'SUCCESS',data:rows.map(row=>({[item.output_dims[0]]:row.raw_region}))};
   const selected=item.filter?.dims?.find(f=>f.dim_name==='raw_region')?.dim_value_list??[];
   const data=selected.length?rows.filter(row=>selected.includes(row.raw_region)):rows;
   return {code:'SUCCESS',data,total_count:data.length};
  });
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({retCode:'CBC.0000',results}));
 } else if(req.url==='/runtime.js') {res.setHeader('Content-Type','text/javascript');res.end(runtime);}
 else if(req.url.startsWith('/detail')) {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<h1>导航已到达</h1>');}
 else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>body{margin:24px}#app{max-width:1200px;margin:auto}</style><div id="app"></div><script src="/runtime.js"></script>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const python=String.raw`
import sys,json,asyncio
from pathlib import Path
sys.path[:0]=['metriccanvas-authoring/tool','metriccanvas-authoring/test-harness/tests']
from fastmcp import Client
from test_interaction_editing import interaction_page,add_filter,link
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
out=Path(sys.argv[1]);feed=out/'baselines';feed.mkdir(exist_ok=True);pages=out/'pages';pages.mkdir(exist_ok=True)
def publish(token,doc):
 (feed/(token+'.json')).write_text(json.dumps({'ref':{'pageId':doc['id'],'revisionId':'r1','resourceId':'resource1'},'document':doc,'documentSha256':document_sha256(doc)}))
async def main():
 config={'mcpServers':{'content':{'command':sys.executable,'args':['-m','metriccanvas_authoring.entrypoints.compat.content_server'],'env':{'PYTHONPATH':str(Path('metriccanvas-authoring/tool').resolve()),'METRICCANVAS_CONTENT_BASELINES_DIR':str(feed)}}}}
 async with Client(config) as c:
  for layout in ['report','dashboard']:
   baseline=interaction_page();baseline['id']='interactions-'+layout;baseline['layout']=layout;publish('trusted-interaction-source',baseline)
   result=await c.call_tool('edit_page',{'baseline_token':'trusted-interaction-source','request':{'operations':[add_filter(),link(dependsOn=['filter'])]}})
   assert result.structured_content['modelSummary']['status']=='changed',result.structured_content
   doc=result.structured_content['artifactEnvelope']['artifact']['document'];(pages/(doc['id']+'.json')).write_text(json.dumps(doc,ensure_ascii=False));publish('edited-interaction-token',doc)
   removed=await c.call_tool('edit_page',{'baseline_token':'edited-interaction-token','request':{'operations':[{'id':'unlink','type':'remove_table_link','componentId':'table','fieldId':'region'},{'id':'remove','type':'remove_dimension_filter','filterId':'region-filter','dependsOn':['unlink']}]}})
   assert removed.structured_content['artifactEnvelope']['artifact']['document']==baseline
   (out/('removed-'+layout+'.json')).write_text(json.dumps(baseline,ensure_ascii=False))
asyncio.run(main())
`;
let browser;
try {
 const child=spawnSync(process.env.METRICCANVAS_TEST_PYTHON??'python3',['-c',python,output],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'});assert.equal(child.status,0,child.stderr);
 assert.equal(requests.length,0,'authoring does not execute page queries');
 browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];const navigations=[];
 for(const layout of ['report','dashboard']) {
  const page=await browser.newPage({viewport:{width:1440,height:1400}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const document=JSON.parse(await readFile(resolve(output,'pages',`interactions-${layout}.json`),'utf8'));
  await page.evaluate(({document,base})=>{window.runtime=MetricCanvas.mount('#app',{document,initialSearch:'context='+encodeURIComponent('业务上下文'),dataGateway:MetricCanvas.createDqeGateway({endpoint:base+'/dqe'})});},{document,base});
  const table=page.locator('[data-component="main/table"]');const other=page.locator('[data-component="main/other-table"]');
  await page.getByRole('tab',{name:'浙江省',exact:true}).click();
  await expect(table.locator('tbody tr')).toHaveCount(1);await expect(table).toContainText('浙江省');await expect(table).not.toContainText('上海市');
  await expect(other.locator('tbody tr')).toHaveCount(2);
  const queries=()=>requests.flatMap(r=>r.dsl_list).filter(i=>i.output_metrics.length>0);
  assert.deepEqual(queries().at(-1).filter.dims,[{dim_name:'raw_region',dim_value_list:['浙江省']}]);
  assert.deepEqual(queries().at(-1).order,{offset:0,limit:20});
  await page.getByRole('tab',{name:'全部',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(2);
  assert.deepEqual(queries().at(-1).filter.dims,[]);
  await page.getByRole('tab',{name:'上海市',exact:true}).click();await expect(table.locator('tbody tr')).toHaveCount(1);await expect(table).toContainText('上海市');
  await page.screenshot({path:resolve(output,`interactions-${layout}.png`),fullPage:true});
  await Promise.all([page.waitForURL('**/detail?**'),table.getByRole('link',{name:'上海市',exact:true}).click()]);
  const url=new URL(page.url());assert.equal(url.pathname,'/detail');assert.equal(url.hash,'#section');
  assert.equal(url.searchParams.get('fixed'),'keep');assert.equal(url.searchParams.get('region'),'上海市');assert.equal(url.searchParams.get('context'),'业务上下文');assert.equal(url.searchParams.get('selected'),'上海市');
  await expect(page.getByRole('heading',{name:'导航已到达'})).toBeVisible();navigations.push(url.searchParams.toString());
  await page.goto(base);const removed=JSON.parse(await readFile(resolve(output,`removed-${layout}.json`),'utf8'));
  await page.evaluate(({document,base})=>{window.runtime=MetricCanvas.mount('#app',{document,initialSearch:'context='+encodeURIComponent('业务上下文'),dataGateway:MetricCanvas.createDqeGateway({endpoint:base+'/dqe'})});},{document:removed,base});
  await expect(page.getByRole('tab')).toHaveCount(0);await expect(page.locator('[data-component="main/table"] a')).toHaveCount(0);
  await expect(page.locator('[data-component="main/table"] tbody tr')).toHaveCount(2);await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,layouts:2,filterQueryAndClear:true,untouchedSource:true,actualNavigations:navigations,removedInteraction:true,errors}));
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
