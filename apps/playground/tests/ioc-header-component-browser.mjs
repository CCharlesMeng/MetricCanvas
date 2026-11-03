import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.PLAYGROUND_BASE_URL??'http://127.0.0.1:5189';
const out=process.env.IOC_HEADER_EVIDENCE??'/tmp/metriccanvas-ioc-component';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1360,height:850}}),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
const header=page.locator('[data-ioc-header]');
const mode=page.getByLabel('验收模式');
async function scene(value){await mode.selectOption(value);}
async function selectedB(){
 await page.getByRole('button',{name:'团队',exact:true}).click();
 await page.getByRole('option',{name:'团队乙',exact:true}).click();
}
try {
 await page.goto(`${base}/pages/ioc-header-section-placement`);
 await expect(header).toHaveCount(1);
 expect(await page.locator('[data-component="main/page-header"]').evaluate(element=>getComputedStyle(element).gridColumn)).toBe('1 / -1');
 checks.push('weighted-section-full-width');await selectedB();
 await expect(page.getByRole('heading',{name:'当前团队：B'})).toBeVisible();
 await page.getByRole('checkbox',{name:'显示首分区'}).uncheck();await expect(header).toHaveCount(0);
 expect(new URL(page.url()).searchParams.get('team')).toBe('B');
 await page.getByRole('checkbox',{name:'显示首分区'}).check();await expect(header).toHaveCount(1);
 await expect(page.getByRole('heading',{name:'当前团队：B'})).toBeVisible();checks.push('mixed-section-hide-restore-url');
 await page.screenshot({path:`${out}/placement.png`,fullPage:true});
 await page.goto(`${base}/pages/ioc-header-section-groups`);
 await page.getByRole('button',{name:'明细',exact:true}).click();await expect(header).not.toBeVisible();
 await page.getByRole('button',{name:'概览',exact:true}).click();await expect(header).toBeVisible();checks.push('section-group-return');
 await page.goto(`${base}/pages/ioc-header-section-sticky`);
 await expect(header).toBeVisible();await page.mouse.wheel(0,800);
 await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);
 expect((await header.boundingBox()).y).toBeGreaterThanOrEqual(0);await expect(header).toHaveCount(1);
 await selectedB();await page.mouse.wheel(0,-2000);
 await expect(page.locator('[data-ioc-floating]')).toHaveCount(0);await expect(header).toContainText('当前团队：B');checks.push('page-sticky-single-instance');
 await page.goto(`${base}/preview?prototype=ioc-header-component`);
 await expect(page.locator('[data-custom-section-ids]')).toHaveAttribute('data-custom-section-ids','main,persistent');await expect(header).toHaveCount(1);
 await header.getByRole('button',{name:'返回验收入口'}).click();await expect(page.locator('output')).toContainText('1');checks.push('custom-layout-and-back');
 await scene('legacy-root');await expect(header).toHaveCount(1);await expect(page.locator('[data-custom-section-ids]')).toHaveAttribute('data-custom-section-ids','main,persistent');
 await scene('legacy-toolbar');await expect(header).toHaveCount(1);checks.push('legacy-custom-inputs');
 await scene('nested');await expect(header).toBeVisible();
 await page.locator('[data-nested-scroll]').hover();await page.mouse.wheel(0,650);
 await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);await expect(header).toHaveCount(1);checks.push('nested-scroll');
 await scene('shadow');await expect(header).toHaveCount(1);await page.mouse.wheel(0,800);await expect(page.locator('[data-ioc-floating]')).toHaveCount(1);checks.push('shadow-root-sticky');
 await page.mouse.wheel(0,-3000);await scene('no-header');await expect(header).toHaveCount(0);checks.push('new-no-default');
 for(const [value,count] of [['export',1],['export-hidden',0],['export-groups',1],['export-legacy-root',1],['export-legacy-toolbar',0]]){
  await scene(value);await expect(header).toHaveCount(count);await expect(page.locator('[data-ioc-floating]')).toHaveCount(0);
  await expect(page.locator('[data-dashboard-back]')).toHaveCount(0);checks.push(value);
 }
 await scene('custom');await page.setViewportSize({width:420,height:850});await expect(header).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('narrow');
 await page.screenshot({path:`${out}/narrow.png`,fullPage:true});
 expect(errors).toEqual([]);
 await writeFile(`${out}/report.json`,JSON.stringify({base,checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
