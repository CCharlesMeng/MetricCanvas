import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
test('three actual navigation pages remain usable at wide and narrow viewports',async({page},testInfo)=>{
 page.on('pageerror',error=>{throw error;});const out=testInfo.outputPath('navigation-layout');mkdirSync(out,{recursive:true});const measurements:unknown[]=[];
 for(const [name,search]of [['source',''],['list','?origin=直接入口'],['detail','?project-id=P001&project-name=示例项目&origin=直接入口&month=2026-09&currency=RMB&regions=north']])for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:900});await page.goto(`/pages/ioc-header-navigation-${name}-demo${search}`);await expect(page.locator('[data-ioc-header]')).toBeVisible();if(name==='detail')await expect(page.locator('[data-component="detail/bound-table"]')).toContainText('project_code=P001');
  const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));expect(geometry.scrollWidth).toBeLessThanOrEqual(width);measurements.push({name,...geometry});if(width===390)await page.screenshot({path:resolve(out,`${name}-390.png`),fullPage:true});
 }
 writeFileSync(resolve(out,'navigation-geometry.json'),JSON.stringify(measurements,null,2)+'\n');
});
