import {createServer} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {chromium,expect} from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const ids=['ioc-auto-back-source','ioc-auto-back-detail','ioc-auto-back-subdetail','ioc-auto-back-unrelated','ioc-default-back-source','ioc-default-back-target','ioc-back-hidden'];
const documents=await Promise.all(ids.map(async id=>JSON.parse(await readFile(`pages/capabilities/navigation/${id}.json`,'utf8'))));
const app=resolve('apps/platform');
const server=await createServer({root:app,configFile:false,plugins:[svelte()],resolve:{alias:{$lib:resolve(app,'src/lib'),$pages:resolve('pages'),$fixtures:resolve('docs/examples')}},server:{host:'127.0.0.1',port:0}});
await server.listen();
const base=server.resolvedUrls.local[0];
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext();
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
function receipt(document){return {retCode:'CBC.0000',page_id:document.id,page_metadata_id:document.id,revision_id:document.id+'-r1',revision_number:1,is_draft:false,page_metadata_definition:JSON.stringify(document)};}
await context.addInitScript(()=>window.__METRICCANVAS__={dqeEndpoint:'',pageMetadataBaseUrl:'/fixture-assets',authToken:'fixture',operatorId:'test-user',workspaceId:'test-workspace'});
await context.route('**/fixture-assets/user-page-metadata**',async route=>{
 const url=new URL(route.request().url()),id=url.pathname.split('/').at(-1);
 expect(route.request().method()).toBe('GET');
 const document=documents.find(value=>value.id===id);
 await route.fulfill({json:document?receipt(document):{retCode:'CBC.0000',total:documents.length,page_metadata_list:documents.map(receipt)}});
});
const source=base+'manage/pages/ioc-auto-back-source?region=north';
const detail=base+'manage/pages/ioc-auto-back-detail?project=2';
const back='[data-ioc-header] [data-dashboard-back]';
async function drill(){await page.goto(source);await page.getByRole('link',{name:/^下钻项目 1/}).click();await expect(page.locator(back)).toBeVisible();}
try{
 await drill();await expect(page).toHaveURL(/\/manage\/pages\/ioc-auto-back-detail\?/);
 await page.reload();await expect(page.locator(back)).toBeVisible();
 await page.getByRole('checkbox',{name:'仅有效'}).check();await expect(page).toHaveURL(/active=true/);
 await page.getByRole('link',{name:/^继续下钻/}).click();await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL(/ioc-auto-back-detail/);await expect(page).toHaveURL(/active=true/);
 await page.locator(back).click();await expect(page).toHaveURL(source);
 await page.goto(base+'manage/pages/ioc-auto-back-unrelated');await page.goto(detail);await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL(base+'manage/pages/ioc-auto-back-unrelated');
 const tab=await context.newPage();await tab.goto(detail);await expect(tab.locator('[data-ioc-title]')).toBeVisible();await expect(tab.locator(back)).toHaveCount(0);
 await page.goto(base+'manage/pages/ioc-back-hidden');await expect(page.locator('[data-ioc-title]')).toBeVisible();await expect(page.locator(back)).toHaveCount(0);
 await page.goto(base+'manage/pages/ioc-default-back-source');await page.getByRole('link',{name:/^打开默认返回页/}).click();await expect(page.locator(back)).toBeVisible();
 await page.locator(back).click();await expect(page).toHaveURL(base+'manage/pages/ioc-default-back-source');
 expect(errors).toEqual([]);console.log('PASS Platform browser return: translated routes, refresh, filters, nested/native return, unrelated previous page, hidden false and fresh tab; fixture HTTP only');
}catch(error){console.log('ERRORS',errors);console.log('ENTRIES',JSON.stringify(await page.evaluate(()=>({href:location.href,entries:navigation.entries().map(e=>({url:e.url,state:e.getState(),key:e.key})),current:navigation.currentEntry.key}))));throw error;}finally{await browser.close();await server.close();}
