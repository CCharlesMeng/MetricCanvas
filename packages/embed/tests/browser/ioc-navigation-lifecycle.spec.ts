import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{page.on('pageerror',error=>{throw error;});});
test('obsolete projection is aborted and cannot replace the new integrating application contract',async({page})=>{
 await page.goto('/pages/ioc-header-navigation-source-demo');const link=page.getByRole('link',{name:'携带已应用条件进入清单',exact:false});await expect(link).toHaveAttribute('href',/navigation-list-demo/);
 await page.evaluate(async()=>{const w=window as any;w.listProjection=MetricCanvas.projectNavigationInputs(await(await fetch('/pages/ioc-header-navigation-list-demo.json')).json());w.runtime.update({document:w.pageDocument,navigation:{resolveTargetInputs(href:string,{signal}:{signal:AbortSignal}){if(!href.includes('navigation-list-demo'))return;w.oldProjectionSignal=signal;return new Promise(resolve=>w.releaseOldProjection=resolve);}}});});
 await expect.poll(()=>page.evaluate(()=>(window as any).oldProjectionSignal!==undefined)).toBe(true);
 await page.evaluate(()=>{const w=window as any;w.runtime.update({document:w.pageDocument,navigation:{resolveTargetInputs:(href:string)=>href.includes('navigation-list-demo')?w.listProjection:undefined}});});await expect(link).toHaveAttribute('href',/origin=/);
 await page.evaluate(()=>{const w=window as any,bad=structuredClone(w.listProjection);bad.params.push({id:'obsolete-required-key',type:'string',required:true});w.releaseOldProjection(bad);});expect(await page.evaluate(()=>(window as any).oldProjectionSignal.aborted)).toBe(true);await expect(link).toHaveAttribute('href',/origin=/);
});
test('withdrawn target-input capability never falls through to an unvalidated browser URL',async({page})=>{
 await page.goto('/pages/ioc-header-navigation-source-demo');await expect(page.getByRole('link',{name:'携带已应用条件进入清单',exact:false})).toHaveAttribute('href',/origin=/);
 await page.evaluate(()=>{const w=window as any;w.runtime.update({document:w.pageDocument});});const link=page.getByRole('link',{name:'携带已应用条件进入清单',exact:false});await expect(link).not.toHaveAttribute('href');await link.click({force:true});await expect(page.locator('[data-navigation-error]')).toContainText('目标输入契约');expect(page.url()).toContain('navigation-source-demo');
});
