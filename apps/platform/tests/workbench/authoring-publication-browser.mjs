import {chromium,expect} from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const base=process.env.S1_BASE_URL||'http://127.0.0.1:5181';const errors=[];page.on('pageerror',e=>errors.push(e.message));
const status=page.getByTestId('publication-status'),publish=page.getByRole('button',{name:'人工确认并发布'});
const acknowledged=page.getByLabel('我已核对当前候选、来源修订及保留取值选择');
async function prepare(){await page.getByRole('button',{name:'准备参数候选'}).click();await expect(page.getByRole('table')).toBeVisible();}
async function preview(){await page.getByRole('button',{name:'预览当前候选'}).click();await expect(page.getByLabel('候选执行预览')).toBeVisible();}
try{
 await page.goto(base+'/publication');await prepare();await expect(page.getByLabel('候选差异')).toBeVisible();await expect(page.getByText('影响数据源：sales、shared')).toBeVisible();await expect(publish).toBeDisabled();
 await preview();await expect(publish).toBeDisabled();await acknowledged.check();await expect(publish).toBeEnabled();
 await page.getByLabel('预览取值 Regions').fill('EMEA');await expect(publish).toBeDisabled();await expect(page.getByLabel('候选执行预览')).toHaveCount(0);
 await preview();await acknowledged.check();
 await page.getByLabel('选择参数 Segment').uncheck();await expect(publish).toBeDisabled();await expect(page.getByText('未选择',{exact:true})).toBeVisible();
 await page.getByLabel('发布时保留具体维度取值').uncheck();await expect(page.getByText('缺少默认取值',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'预览当前候选'}).click();await expect(status).toContainText('执行被拒绝');await expect(publish).toBeDisabled();await page.getByLabel('预览取值 Regions').fill('APAC');
 await preview();await acknowledged.check();await mkdir('/private/tmp/metriccanvas-s1-evidence',{recursive:true});await page.screenshot({path:'/private/tmp/metriccanvas-s1-evidence/t19-review.png'});await publish.click();await expect(page.getByTestId('published-reference')).toContainText('immutable-template');
 await expect(page.getByLabel('替身调用计数')).toContainText('"publish":1');
 await page.getByRole('button',{name:'模拟草稿已修改'}).click();await expect(page.getByTestId('published-reference')).toContainText('template-version');
 await page.reload();await prepare();await preview();await page.getByRole('button',{name:'模拟草稿已修改'}).click();await expect(page.getByRole('table')).toHaveCount(0);await expect(status).toContainText('失效');
 for(const mode of ['expired','lease','forbidden','bad-proof']){
  await page.reload();await prepare();await preview();await page.getByLabel('发布验收场景').selectOption(mode);await acknowledged.check();await publish.click();await expect(status).toContainText('失败');await expect(page.getByLabel('替身调用计数')).toContainText('"publish":0');
 }
 await page.reload();await page.getByLabel('发布验收场景').selectOption('blocking');await prepare();await expect(page.getByRole('alert')).toBeVisible();await preview();await expect(publish).toBeDisabled();
 await page.reload();await prepare();await preview();await page.getByLabel('发布验收场景').selectOption('lost-ack');await acknowledged.check();await publish.click();await expect(status).toContainText('回执丢失');
 await page.getByLabel('发布验收场景').selectOption('success');await page.getByRole('button',{name:'查询原发布操作'}).click();await expect(page.getByTestId('published-reference')).toBeVisible();await expect(page.getByLabel('替身调用计数')).toContainText('"publish":1');
 await mkdir('/private/tmp/metriccanvas-s1-evidence',{recursive:true});await page.screenshot({path:'/private/tmp/metriccanvas-s1-evidence/t19-published.png'});
 const workbench=await browser.newPage();let writes=0;
 await workbench.addInitScript(()=>{window.__METRICCANVAS__={dqeEndpoint:'/fixture-dqe',pageAssetsBaseUrl:'/fixture-assets',authToken:'fixture',operatorId:'alice',workspaceId:'workspace'};});
 const doc={schemaVersion:'6.2',layout:'report',id:'publication-default',dataSources:{},sections:[{id:'main',components:[{id:'t',type:'text',layout:{span:12},props:{title:'保留工作副本',body:'原文'}}]}]};
 const row={retCode:'0',page_metadata_id:'metadata-pub',page_id:doc.id,revision_id:'r1',revision_number:1,page_metadata_definition:JSON.stringify(doc)};
 await workbench.route('**/fixture-assets/user-page-metadata**',async route=>{if(route.request().method()!=='GET')writes++;await route.fulfill({json:route.request().url().includes('?')?{retCode:'0',total:1,page_metadata_list:[row]}:row});});
 await workbench.goto(base+'/?page=publication-default');await expect(workbench.getByRole('main',{name:'页面画布'}).getByText('保留工作副本')).toBeVisible();
 await workbench.getByRole('button',{name:'发布评审',exact:true}).click();await workbench.getByRole('button',{name:'准备参数候选'}).click();
 await expect(workbench.getByTestId('publication-status')).toContainText('CAPABILITY_UNAVAILABLE');expect(writes).toBe(0);
 await expect(workbench.getByRole('main',{name:'页面画布'}).getByText('保留工作副本')).toBeVisible();await workbench.close();
 if(process.env.S1_PRODUCTION_URL){let fixtures=0;page.on('request',req=>{if(req.url().includes('publication-fixture'))fixtures++;});await page.goto(process.env.S1_PRODUCTION_URL+'/publication');await expect(page.getByText('发布组合验收入口仅供开发环境使用。')).toBeVisible();await expect(page.getByRole('button',{name:'准备参数候选'})).toHaveCount(0);expect(fixtures).toBe(0);}
 expect(errors).toEqual([]);console.log('T19 UI PASS: corrections/preview/explicit human confirmation, expiry/lease/identity boundaries, stale source, blocking, lost receipt lookup, immutable publication, production gate.');
}finally{await browser.close();}
