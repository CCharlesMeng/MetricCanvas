import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
const document=JSON.parse(readFileSync(new URL('../../../../pages/capabilities/layout/metric-card-equation.json',import.meta.url),'utf8'));

for(const mode of ['classic','esm'] as const) {
  test(`${mode} 正式页面的连接文字双侧8px、四卡等宽与窄屏单列`,async({page})=>{
    await page.setViewportSize({width:1440,height:1000});
    await page.goto('/examples/inline.html');
    await page.evaluate(async({document,mode})=>{
      window.runtime.destroy();
      const url='/dist/metriccanvas-runtime.es.js';
      const mount=mode==='classic'?MetricCanvas.mount:(await import(url)).mount;
      window.runtime=mount('#dashboard',{document});
    },{document,mode});
    const row=page.locator('[data-metric-connection-row="total-card"]');
    await expect(row).toHaveCSS('box-sizing','border-box');
    await expect(row).toHaveCSS('border-top','1px solid rgba(0, 0, 0, 0.1)');
    await expect(row).toHaveCSS('border-radius','16px');
    await expect(row).toHaveCSS('background-color','rgb(255, 255, 255)');
    await expect(row.locator('[data-component]')).toHaveCount(4);
    // 小卡片必须保留真实独立外框，8px间距量到可见边框而不是透明布局盒。
    for(const card of await page.locator('[data-metric-connection-row] [data-component]').all()) {
      await expect(card).toHaveCSS('background-color','rgb(255, 255, 255)');
      await expect(card).toHaveCSS('border-top','1px solid rgba(0, 0, 0, 0.1)');
      await expect(card).toHaveCSS('border-radius','12px');
      await expect(card.locator('.metric-panel')).toHaveCSS('background-color','rgb(255, 255, 255)');
      await expect(card.locator('.metric-panel')).toHaveCSS('border-top-width','0px');
    }
    await expect.poll(()=>row.locator('[data-component]').evaluateAll(nodes=>new Set(nodes.map(node=>Math.round(node.getBoundingClientRect().top))).size)).toBe(1);
    const gaps=await row.evaluate(node=>{
      const cards=[...node.querySelectorAll('[data-component]')].map(element=>element.getBoundingClientRect());
      const text=[...node.querySelectorAll('[data-metric-connector]')].map(element=>element.getBoundingClientRect());
      return {widths:cards.map(rect=>rect.width),gaps:text.flatMap((rect,index)=>[rect.left-cards[index].right,cards[index+1].left-rect.right])};
    });
    expect(Math.max(...gaps.widths)-Math.min(...gaps.widths)).toBeLessThan(.5);
    for(const gap of gaps.gaps)expect(Math.abs(gap-8)).toBeLessThan(.5);
    const wordGaps=await page.locator('[data-metric-connection-row="word-total"]').evaluate(node=>{
      const cards=[...node.querySelectorAll('[data-component]')].map(element=>element.getBoundingClientRect());
      return [...node.querySelectorAll('[data-metric-connector]')].flatMap((element,index)=>{
        const rect=element.getBoundingClientRect();return [rect.left-cards[index].right,cards[index+1].left-rect.right];
      });
    });
    for(const gap of wordGaps)expect(Math.abs(gap-8)).toBeLessThan(.5);
    // 拉伸填满所占栅格，外框的边框/内边距不能撑宽页面。
    for(const width of [1980,1024,800]) {
      await page.setViewportSize({width,height:1000});
      await expect.poll(()=>row.evaluate(node=>{
        const frame=node.getBoundingClientRect();
        const grid=node.parentElement!.getBoundingClientRect();
        const cards=[...node.querySelectorAll('[data-component]')].map(card=>card.getBoundingClientRect());
        return Math.max(Math.abs(frame.left-grid.left),Math.abs(frame.right-grid.right),
          Math.abs(cards[0].left-frame.left-21),Math.abs(frame.right-cards.at(-1)!.right-21));
      })).toBeLessThan(.5);
    }
    // 宽度足够容纳原来的四卡，但扣除新外框后不足，必须退化成单列。
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#dashboard').evaluate(node=>(node as HTMLElement).style.width='680px');
    await expect.poll(()=>row.locator('[data-component]').evaluateAll(nodes=>new Set(nodes.map(node=>Math.round(node.getBoundingClientRect().top))).size)).toBe(4);
    await page.locator('#dashboard').evaluate(node=>(node as HTMLElement).style.removeProperty('width'));
    const partial=structuredClone(document);
    partial.sections=partial.sections.filter((section:{id:string})=>section.id==='equation');
    partial.sections[0].components.forEach((component:{layout:{span:number}})=>component.layout.span=1);
    await page.evaluate(document=>window.runtime.update({document}),partial);
    await expect.poll(()=>row.locator('[data-component]').evaluateAll(nodes=>new Set(nodes.map(node=>Math.round(node.getBoundingClientRect().top))).size)).toBe(4);
    await page.evaluate(document=>window.runtime.update({document}),document);
    await page.setViewportSize({width:390,height:900});
    await expect.poll(()=>row.locator('[data-component]').evaluateAll(nodes=>new Set(nodes.map(node=>Math.round(node.getBoundingClientRect().top))).size)).toBe(4);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    const vertical=await row.evaluate(node=>{
      const cards=[...node.querySelectorAll('[data-component]')].map(element=>element.getBoundingClientRect());
      return [...node.querySelectorAll('[data-metric-connector]')].flatMap((element,index)=>{
        const rect=element.getBoundingClientRect();return [rect.top-cards[index].bottom,cards[index+1].top-rect.bottom];
      });
    });
    for(const gap of vertical)expect(Math.abs(gap-8)).toBeLessThan(.5);
  });
}
