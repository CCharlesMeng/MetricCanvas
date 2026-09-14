// Build this worktree's packages/embed, then run with METRICCANVAS_TEST_PYTHON
// pointing at the Python interpreter containing the Bundle dependencies.
// This is an explicit local SSE protocol boundary, not evidence of a real provider.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile,mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const {chromium,expect}=createRequire(new URL('../../packages/embed/package.json',import.meta.url))('@playwright/test');
const root=resolve(import.meta.dirname,'../..');
const output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
const runtime=await readFile(resolve(root,'packages/embed/dist/metriccanvas-runtime.global.js'));
const requests=[];
const server=createServer(async(req,res)=>{
 if(req.url.startsWith('/conversations/')) {
  let body='';for await(const chunk of req)body+=chunk;requests.push(JSON.parse(body));
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  res.write('data: '+JSON.stringify({event:'generate',content:'地域经营稳定，'})+'\n\n');
  setTimeout(()=>{res.write('data: '+JSON.stringify({event:'generate',content:'上海市金额为 42。'})+'\n\n');res.end('data: {"event":"finish"}\n\n');},400);
 } else if(req.url==='/runtime.js') {res.setHeader('Content-Type','text/javascript');res.end(runtime);}
 else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><style>body{margin:24px}#app{max-width:1200px;margin:auto}</style><div id="app"></div><script src="/runtime.js"></script>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const python=String.raw`
import sys,os,json,asyncio
from pathlib import Path
sys.path[:0]=['metriccanvas-authoring/tool','metriccanvas-authoring/test-harness/tests']
from fastmcp import Client
from test_text_map_building import content_page,recipe
from test_container_building import composite,tabs,summary,child
from metriccanvas_authoring.application.edit_page import document_sha256
output=Path(sys.argv[1]);feed=output/'baselines';feed.mkdir(exist_ok=True);pages=output/'pages';pages.mkdir(exist_ok=True)
def publish(token,doc):
 (feed/(token+'.json')).write_text(json.dumps({'ref':{'pageId':doc['id'],'revisionId':'r1','resourceId':'resource1'},'document':doc,'documentSha256':document_sha256(doc)}))
publish('trusted-content-source',content_page())
async def main():
 config={'mcpServers':{'content':{'command':sys.executable,'args':['-m','metriccanvas_authoring.content_server'],'env':{'PYTHONPATH':str(Path('metriccanvas-authoring/tool').resolve()),'METRICCANVAS_CONTENT_BASELINES_DIR':str(feed),'METRICCANVAS_CONTENT_AI_SUMMARY_CONFIG':json.dumps({'conversationBaseUrl':sys.argv[2]})}}}}
 async with Client(config) as client:
  for layout in ['report','dashboard']:
   op=composite(title='组合经营指标',children=[child(title='总额指标'),child('pieChart','nested-pie','sales',title='地域占比')])
   result=await client.call_tool('create_content_page',{'page_id':'containers-'+layout,'title':'容器与流式总结','layout':layout,'source_token':'trusted-content-source','request':{'operations':[recipe('text',title='AI 总结'),op,tabs(),summary(title='动态经营总结')]}})
   assert result.structured_content['modelSummary']['status']=='changed',result.structured_content
   doc=result.structured_content['artifactEnvelope']['artifact']['document']
   (pages/(doc['id']+'.json')).write_text(json.dumps(doc,ensure_ascii=False))
   publish('created-content-token',doc)
   deleted=await client.call_tool('edit_page',{'baseline_token':'created-content-token','request':{'operations':[{'id':k,'type':'remove_component','componentId':k} for k in ['composite','tabs','summary']]}})
   assert deleted.structured_content['modelSummary']['status']=='changed',deleted.structured_content
   removed=deleted.structured_content['artifactEnvelope']['artifact']['document']
   (output/('removed-'+layout+'.json')).write_text(json.dumps(removed,ensure_ascii=False))
asyncio.run(main())
`;
let browser;
try {
 const child=spawnSync(process.env.METRICCANVAS_TEST_PYTHON??'python3',['-c',python,output,base+'/conversations'],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
 assert.equal(requests.length,0,'content creation/deletion must not generate runtime summaries');
 browser=await chromium.launch({channel:'chrome',headless:true});
 const errors=[];
 for(const layout of ['report','dashboard']) {
  const page=await browser.newPage({viewport:{width:1440,height:1300}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const document=JSON.parse(await readFile(resolve(output,'pages',`containers-${layout}.json`),'utf8'));
  await page.evaluate(({document,endpoint})=>{window.runtime=MetricCanvas.mount('#app',{document,aiSummary:{conversationBaseUrl:endpoint}});},{document,endpoint:base+'/conversations'});
  const card=page.locator('[data-component-type="compositeCard"]');await expect(card).toContainText('总额指标');await expect(card).toContainText('12');
  await card.locator('canvas').waitFor();
  const tabs=page.locator('[data-component-type="tabContainer"]');
  await expect(tabs.getByRole('tab',{name:'概览'})).toHaveAttribute('aria-selected','true');
  await tabs.getByRole('tab',{name:'明细'}).click();
  await expect(tabs.getByRole('tab',{name:'明细'})).toHaveAttribute('aria-selected','true');
  await expect(tabs.getByRole('tabpanel')).toContainText('上海市');
  await expect(page.locator('[data-component-type="aiSummary"]')).toContainText('上海市金额为 42。');
  assert.equal(requests.length,layout==='report'?1:2,'ordinary text must not produce SSE');
  const data=requests.at(-1).context_info['ai-summary'].input_data;
  assert.deepEqual(data.business_data,[{question:'地域经营数据',data:{region:['上海市','浙江省'],amount:[42,18]}}]);
  await page.screenshot({path:resolve(output,`containers-${layout}.png`),fullPage:true});
  const removed=JSON.parse(await readFile(resolve(output,`removed-${layout}.json`),'utf8'));
  await page.evaluate(document=>{window.runtime.destroy();window.runtime=MetricCanvas.mount('#app',{document});},removed);
  await expect(page.locator('[data-component-type="compositeCard"]')).toHaveCount(0);
  await expect(page.locator('[data-component-type="tabContainer"]')).toHaveCount(0);
  await expect(page.locator('[data-component-type="aiSummary"]')).toHaveCount(0);
  await expect(page.locator('[data-component-type="text"]')).toContainText('增长保持稳定');
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,layouts:2,tabSwitch:true,composite:true,summaryRequests:requests.length,whitelistedData:true,subtreeDeletion:true,errors}));
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
