import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({ignoreHTTPSErrors:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const root=process.env.JAVA_ASSETS_BASE_URL || 'https://127.0.0.1:5196';
let doc={schemaVersion:'6.4',layout:'report',id:'asset-test',dataSources:{},sections:[{id:'main',components:[{id:'text',type:'text',layout:{span:12},props:{title:'原始标题',body:'页面内容'}}]}]};
let revision=1,isDraft=true,writes=0;
const receipt=()=>({retCode:'CBC.0000',page_id:doc.id,page_metadata_id:'metadata-1',revision_id:`r${revision}`,revision_number:revision,is_draft:isDraft,page_metadata_definition:JSON.stringify(doc)});
try {
 await page.addInitScript(()=>{window.__METRICCANVAS__={dqeEndpoint:'',pageMetadataBaseUrl:'/fixture-assets',authToken:'fixture',operatorId:'test-user',workspaceId:'test-workspace'};});
 await page.route('**/*',route=>new URL(route.request().url()).origin===root ? route.continue() : route.abort());
 await page.route('**/fixture-assets/user-page-metadata**',async route=>{
  const req=route.request();
  if(req.url().endsWith('/history'))return route.fulfill({json:{retCode:'CBC.0000',history_list:[{history_id:'h1',page_metadata_id:'metadata-1',draft_version:1,comment:'初稿'}]}});
  if(req.url().endsWith('/rollback')){expect(req.postDataJSON()).toEqual({target_draft_version:1});revision++;isDraft=true;return route.fulfill({json:receipt()});}
  if(req.method()==='DELETE')return route.fulfill({status:204});
  if(req.method()==='PUT'){const body=req.postDataJSON();expect(body.base_revision_id).toBe(`r${revision}`);doc=body.page_metadata_definition;isDraft=body.is_draft;revision++;writes++;}
  return route.fulfill({json:req.url().includes('?')?{retCode:'CBC.0000',total:1,page_metadata_list:[receipt()]}:receipt()});
 });
 await page.goto(`${root}/manage`);
 await page.getByRole('link',{name:/asset-test/}).click();
 await expect(page.getByText('版本 1 · 初稿')).toBeVisible();
 await page.getByRole('link',{name:'编辑当前页面'}).click();
 const inspector=page.getByRole('complementary',{name:'检查器'});
 await inspector.getByRole('button',{name:/原始标题/}).click();
 await inspector.getByLabel('组件标题').fill('修改后的标题');
 await inspector.getByLabel('组件标题').press('Tab');
 await expect.poll(()=>writes).toBe(1);
 await expect(page.getByText('服务端已保存修订 R2')).toBeVisible();
 page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'发布页面',exact:true}).click();
 await expect(page.getByText('当前页面已发布。')).toBeVisible();
 expect(writes).toBe(2);expect(isDraft).toBe(false);
 await page.reload();
 await expect(inspector.getByRole('button',{name:/修改后的标题/})).toBeVisible();
 expect(writes).toBe(2);
 await page.goto(`${root}/manage/pages/asset-test?resource=metadata-1`);
 await page.getByRole('button',{name:'恢复此版本'}).click();
 await expect(page.getByText('已回退，当前页面已更新。')).toBeVisible();
 await page.getByRole('button',{name:'删除页面'}).click();
 await expect(page).toHaveURL(`${root}/manage`);
 await page.getByRole('link',{name:'创建新页面'}).click();
 await expect(page).toHaveURL(`${root}/?new=1`);
 expect(writes).toBe(2);expect(errors).toEqual([]);
 console.log('PASS: directory → resource edit → single save → publish → reload → history/restore/delete → empty new-page entry. HTTP fixtures only.');
} catch(error) { console.error(await page.locator('body').innerText());console.error(errors);throw error; } finally {await browser.close();}
