import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base=process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5193';
const output=process.argv[2] ?? '/tmp/metriccanvas-local-authoring-browser';
const document=JSON.parse(await readFile(new URL('../../../pages/capabilities/layout/local-authoring-knowledge-demo.json',import.meta.url),'utf8'));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage();const errors=[];const receipts=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:850});
    await page.goto(`${base}/pages/${document.id}`);
    const runtime=page;
    await expect(runtime.locator('[data-component="overview/amount-card"]')).toContainText('4,200.0万');
    await expect(runtime.locator('[data-component="overview/rate-card"]')).toContainText('42.0%');
    const table=runtime.locator('[data-component="overview/summary-table"]');
    await expect(table.getByRole('cell',{name:'华东示范区',exact:true})).toBeVisible();
    await expect(table.getByRole('cell',{name:'42.0%',exact:true})).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveCount(document.sections[0].components[2].props.columns.length);
    if(width===390) {
      const scrolled=await table.evaluate(root=>{
        const container=[...root.querySelectorAll('*')].find(element=>element.scrollWidth>element.clientWidth && ['auto','scroll'].includes(getComputedStyle(element).overflowX));
        if(!container) return false;
        container.scrollLeft=container.scrollWidth;return container.scrollLeft>0;
      });
      expect(scrolled).toBe(true);
    }
    await page.screenshot({path:path.join(output,`page-${width}.png`),fullPage:true});
    receipts.push({width,amount:'4,200.0万',rate:'42.0%',rows:await table.locator('tbody tr').count()});
  }
  await page.setViewportSize({width:1280,height:850});await page.goto(base);
  await page.getByRole('searchbox',{name:'搜索页面',exact:true}).fill('local-authoring-knowledge-demo');
  await expect(page.locator(`.page-card[href="/pages/${document.id}"]`)).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile(path.join(output,'browser.json'),JSON.stringify({pageId:document.id,receipts,errors,catalogDiscoverable:true,data:'inline synthetic; real query not run'},null,2));
} finally {await browser.close();}
