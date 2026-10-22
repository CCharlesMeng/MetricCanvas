import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const base=process.env.VISIBILITY_BASE_URL??'http://127.0.0.1:5185';
const output=process.argv[2]??'/tmp/metriccanvas-visibility';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const section=id=>page.locator(`[data-section-id="${id}"]`);
try{
 await page.goto(`${base}/pages/page-visibility-region-linkage`);
 await expect(section('department-norms')).toBeVisible();
 await page.getByRole('tab',{name:'地区部',exact:true}).first().click();
 await expect(section('department-norms')).toHaveCount(0);
 await expect(section('retained-container')).toBeVisible();
 await expect(page.getByRole('button',{name:'条件组A',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'条件组B',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(section('group-b').locator('article')).toHaveCount(0);
 await expect(section('retained-container').locator('article')).toHaveCount(0);
 await expect(page.locator('.tab-container').getByRole('tab',{name:'地区部',exact:true})).toHaveCount(0);
 await expect(page.locator('.tab-container').getByRole('tab',{name:'代表处',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByText('当前展示：地区部，文字使用同一条件求值。',{exact:true})).toBeVisible();
 expect(new URL(page.url()).searchParams.get('organization.level')).toBe('department');
 await page.reload();await expect(section('department-norms')).toHaveCount(0);
 await expect(section('retained-container')).toBeVisible();
 await page.getByRole('tab',{name:'全球',exact:true}).click();
 await expect(section('department-norms')).toBeVisible();
 await expect(section('retained-container').locator('article')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'条件组B',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'显示扩展内容',exact:true}).click();await expect(section('extra')).toBeVisible();
 await expect(page.getByRole('button',{name:'条件组A',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'条件组B',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'恢复基础内容',exact:true}).click();await expect(section('extra')).toHaveCount(0);
 await page.screenshot({path:path.join(output,'wide.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('tab',{name:'地区部',exact:true}).first().click();
 await expect(section('retained-container')).toBeVisible();await expect(section('department-norms')).toHaveCount(0);
 await page.screenshot({path:path.join(output,'narrow.png'),fullPage:true});
 // Fact inputs update the existing instance; a new permission revision invalidates it.
 await page.goto(`${base}/pages/page-visibility-inputs`);
 await expect(section('intro')).toBeVisible();await expect(section('protected')).toHaveCount(0);
 await page.getByRole('button',{name:'允许',exact:true}).click();await expect(section('protected')).toBeVisible();await expect(section('fact')).toBeVisible();
 await page.getByRole('button',{name:'拒绝',exact:true}).click();await expect(section('protected')).toHaveCount(0);await expect(section('intro')).toBeVisible();
 await page.getByRole('button',{name:'输入错误',exact:true}).click();await expect(section('fact')).toHaveCount(0);await expect(section('intro')).toBeVisible();
 await page.getByRole('button',{name:'允许',exact:true}).click();await expect(section('protected')).toBeVisible();
 await page.getByRole('button',{name:'更换权限会话',exact:true}).click();await expect(section('intro')).toHaveCount(0);
 await expect(page.getByText('权限会话已变化，请以当前身份重新初始化页面',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'重新初始化',exact:true}).click();await expect(section('protected')).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`${base}/pages/page-visibility-report?organization.level=department`);
 await expect(section('department-norms')).toHaveCount(0);
 await page.evaluate(()=>{
  const Original=window.Worker;window.visibilityWorker=Original;window.visibilityExports=[];
  window.Worker=class extends Original{constructor(...args){super(...args);
   const view=document.querySelector('[data-report-export-frame]')?.contentDocument?.querySelector('[data-export-view]');
   if(view){window.visibilityExports.push({sections:[...view.querySelectorAll('[data-section-id]')].map(n=>n.dataset.sectionId),retainedChildren:view.querySelector('[data-section-id="retained-container"]')?.querySelectorAll('article').length,tabs:[...view.querySelectorAll('[data-export-tab]')].map(n=>n.dataset.exportTab),rows:[...view.querySelectorAll('[data-export-component="projected-table"] tbody tr')].map(n=>n.textContent)});
    // A normal selection change after capture cannot alter the export document.
    document.querySelector('[data-filter-id="organization"] button')?.click();
   }
  }};
 });
 let download=page.waitForEvent('download');await page.getByRole('button',{name:'下载条件PDF',exact:true}).click();
 const pdf=await download;const pdfPath=path.join(output,'visibility.pdf');await pdf.saveAs(pdfPath);
 expect((await readFile(pdfPath)).subarray(0,4).toString()).toBe('%PDF');
 const captured=await page.evaluate(()=>window.visibilityExports[0]);
 expect(captured.sections).not.toContain('department-norms');expect(captured.retainedChildren).toBe(0);expect(captured.tabs).toEqual(['office']);expect(captured.rows).toHaveLength(2);
 await page.evaluate(()=>window.Worker=window.visibilityWorker);
 await page.getByRole('tab',{name:'地区部',exact:true}).first().click();
 download=page.waitForEvent('download');await page.getByRole('button',{name:'下载条件PNG',exact:true}).click();await(await download).saveAs(path.join(output,'visibility.png'));
 download=page.waitForEvent('download');await page.locator('[data-component="rows-and-tabs/projected-table"]').getByRole('button',{name:'导出',exact:true}).click();await(await download).saveAs(path.join(output,'visibility.xlsx'));
 // Cancel at the actual worker seam after a new permission revision.
 await page.goto(`${base}/pages/page-visibility-inputs`);await page.getByRole('button',{name:'允许',exact:true}).click();
 let canceledDownload=false;const markDownload=()=>canceledDownload=true;page.on('download',markDownload);
 await page.evaluate(()=>{const Original=window.Worker;window.visibilityWorker=Original;window.Worker=class extends Original{constructor(...args){super(...args);queueMicrotask(()=>[...document.querySelectorAll('[data-sim-facts] button')].find(button=>button.textContent==='更换权限会话')?.click());}};});
 await page.getByRole('button',{name:'导出Sim权限PDF',exact:true}).click();
 await expect(page.getByText('权限会话已变化，请以当前身份重新初始化页面',{exact:true})).toBeVisible();
 await expect(page.locator('[data-report-export-frame]')).toHaveCount(0);
 expect(canceledDownload).toBe(false);page.off('download',markDownload);
 await page.evaluate(()=>window.Worker=window.visibilityWorker);
 // Public JS API receives the same source, without Playground-specific wiring.
 await page.goto(`${base}/pages/page-visibility-region-linkage`);
 const inputDocument=JSON.parse(await readFile(new URL('../../../pages/page-visibility-inputs.json',import.meta.url),'utf8'));
 const embedModule='/@fs'+new URL('../../../packages/embed/src/index.ts',import.meta.url).pathname;
 await page.evaluate(async({document:metadata,embedModule})=>{
  const {mount}=await import(embedModule);
  const host=document.createElement('div');host.id='public-embed';document.body.append(host);
  let snapshot={permissionRevision:'public-1',permissions:{'department.read':{status:'pending'}},values:{ready:{status:'pending'}}};
  const listeners=new Set();
  const source={getSnapshot:()=>snapshot,subscribe:run=>{listeners.add(run);return()=>listeners.delete(run);}};
  const events=[];
  const options={document:metadata,displayInputs:source,onEvent:event=>events.push(event)};
  let handle=mount(host,options);
  window.visibilityEmbed={publish(allowed,revision='public-1'){
   snapshot={permissionRevision:revision,permissions:{'department.read':{status:'ready',value:allowed}},values:{ready:{status:'ready',value:allowed}}};
   for(const run of listeners)run(snapshot);
  },replaceSource(){
   snapshot={permissionRevision:'public-2',permissions:{'department.read':{status:'ready',value:false}},values:{ready:{status:'ready',value:false}}};
   options.displayInputs={getSnapshot:()=>snapshot,subscribe:run=>{listeners.add(run);return()=>listeners.delete(run);}};
   handle.update(options);
  },remount(){handle.destroy();handle=mount(host,options);},destroy(){handle.destroy();host.remove();},events};
 },{document:inputDocument,embedModule});
 const embed=page.locator('#public-embed');
 await expect(embed.locator('[data-section-id="intro"]')).toBeVisible();
 await expect(embed.locator('[data-section-id="protected"]')).toHaveCount(0);
 await page.evaluate(()=>window.visibilityEmbed.publish(true));
 await expect(embed.locator('[data-section-id="protected"]')).toBeVisible();
 await page.evaluate(()=>window.visibilityEmbed.replaceSource());
 await expect(embed.getByText('权限会话已变化，请以当前身份重新初始化页面',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.visibilityEmbed.remount());
 await expect(embed.locator('[data-section-id="intro"]')).toBeVisible();
 await expect(embed.locator('[data-section-id="protected"]')).toHaveCount(0);
 await page.evaluate(()=>window.visibilityEmbed.destroy());
 expect(errors).toEqual([]);
 const result={status:'pass',browser:browser.version(),scenarios:['level-only-switch','parent-retained','tab-fallback','conditional-parts','url-level-restore','fixed-filter-buttons','wide-and-narrow','fact-inputs','permission-invalidation','pdf-frozen-content','png-export','xlsx-export','permission-cancels-download','public-js-display-inputs','section-group-fallback-and-empty','replaced-source-keeps-permission-boundary'],errors};
 await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
