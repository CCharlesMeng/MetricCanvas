import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const output=process.argv[2] ?? '/tmp/metriccanvas-table-detail-width';
const base=process.env.PLAYGROUND_BASE_URL ?? 'http://localhost:5173';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const facts=[];
try {
 for(const viewport of [1440,1920,390]) {
  await page.setViewportSize({width:viewport,height:1000});
  await page.goto(`${base}/pages/table-detail-overlay`);
  const runtime=page.locator('.runtime-view');
  await expect(runtime.getByRole('button',{name:'8',exact:true})).toBeVisible();
  for(const [name,surface] of [['8','modal'],['3','drawer'],['0','empty'],['861,000','fields'],['订单详情 8','metric']]) {
   await runtime.getByRole('button',{name,exact:true}).click();
   const dialog=runtime.getByRole('dialog');await expect(dialog).toBeVisible();
   const box=await dialog.boundingBox();const host=await runtime.locator('.detail-backdrop').boundingBox();
   const target=surface==='fields'?Math.min(560,host.width-48):Math.min(1440,host.width*.9,host.width-32);
   expect(box.width).toBeCloseTo(target,0);
   const overflow=await dialog.evaluate(el=>el.scrollWidth-el.clientWidth);expect(overflow).toBeLessThanOrEqual(1);
   facts.push({viewport,surface,containerWidth:host.width,panelWidth:box.width,target,overflow});
   if(surface==='modal'||surface==='drawer') await page.screenshot({path:`${output}/${surface}-${viewport}.png`});
   if(surface==='modal'&&viewport===1440) {
    await dialog.getByRole('button',{name:'下一页',exact:true}).click();await expect(dialog).toContainText('SO-0908');
   }
   if(surface==='modal'&&viewport===390) {
    const scroll=dialog.locator('.scroll');const geometry=await scroll.evaluate(el=>({width:el.clientWidth,content:el.scrollWidth}));
    expect(geometry.content).toBeGreaterThan(geometry.width);await scroll.evaluate(el=>{el.scrollLeft=200;});
    expect(await scroll.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
   }
   await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  }
 }
 expect(errors).toEqual([]);
 await writeFile(`${output}/browser.json`,JSON.stringify({url:`${base}/pages/table-detail-overlay`,facts,pageErrors:errors},null,2)+'\n');
 console.log(JSON.stringify({passed:facts.length,facts,pageErrors:errors},null,2));
} finally {await browser.close();}
