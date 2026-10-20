import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../../..'),out=resolve(root,'docs/evidence/ioc-header-b4/evidence');
const contract=JSON.parse(readFileSync(resolve(out,'restore-contract.json'),'utf8')),adapter=JSON.parse(readFileSync(resolve(out,'restore-adapter.json'),'utf8'));
const collector=readFileSync('/Users/moon/Documents/Code/moon-skills/skills/sdd-dev-frontend/scripts/collect_restore_facts.js','utf8');
test.use({timezoneId:'Asia/Shanghai'});
test('collect frozen B4 restore rules at all three widths and open ShadowRoot',async({page})=>{
 test.setTimeout(60_000);page.on('pageerror',error=>{throw error;});await page.clock.install({time:new Date('2026-10-19T12:00:00+08:00')});mkdirSync(resolve(out,'artifacts'),{recursive:true});const geometry:unknown[]=[];
 async function collect(name:string){await page.evaluate(input=>(window as any).__SDD_RESTORE_INPUT__=input,{contract,adapter});const result=await page.evaluate(collector);if(!result||typeof result!=='object'||Array.isArray(result))throw Error('采集结果必须为对象');writeFileSync(resolve(out,`render-${name}.json`),JSON.stringify(result,null,2)+'\n');geometry.push({name,...result});}
 for(const name of ['time-modes','time-presets','availability','calendar-window'])for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:900});await page.goto(`/pages/ioc-header-${name}-demo`);await expect(page.locator('[data-component="body/bound-table"]')).toContainText('合成');const expand=page.getByRole('button',{name:'展开筛选',exact:true});if(await expand.isVisible())await expand.click();
  await page.getByRole('button',{name:'打开日期选择器',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await collect(`${name}-${width}`);await page.screenshot({path:resolve(out,`artifacts/${name}-${width}.png`),fullPage:true});
 }
 await page.goto('/pages/ioc-header-time-modes-demo');await expect(page.locator('[data-component="body/bound-table"]')).toContainText('合成');
 await page.evaluate(()=>{const w=window as any;w.runtime.destroy();const host=document.createElement('div');host.id='shadow-time';document.body.append(host);const root=host.attachShadow({mode:'open'}),target=document.createElement('main');root.append(target);w.runtime=MetricCanvas.mount(target,{document:w.pageDocument,dataGateway:w.dataGateway});});
 await expect(page.locator('#shadow-time [data-time-modes]')).toBeVisible();await page.locator('#shadow-time').getByRole('button',{name:'ISO周',exact:true}).click();await page.locator('#shadow-time').getByRole('button',{name:'打开日期选择器',exact:true}).click();await expect(page.locator('#shadow-time').getByRole('dialog')).toBeVisible();await collect('shadow-390');await page.screenshot({path:resolve(out,'artifacts/shadow-390.png'),fullPage:true});
 writeFileSync(resolve(out,'artifacts/panel-geometry.json'),JSON.stringify(geometry,null,2)+'\n');
});
