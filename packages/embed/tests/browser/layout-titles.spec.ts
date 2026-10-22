import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';

const documents=Object.fromEntries(['report','dashboard'].map(layout=>[layout,JSON.parse(readFileSync(new URL(`../../../../pages/${layout}-title-styles.json`,import.meta.url),'utf8'))]));

for(const width of [1440,390]) {
  test(`${width} 标题按Report和Dashboard分别呈现，plain不回退共用标题`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.goto('/examples/inline.html');
    for(const layout of ['report','dashboard','report']) {
      await page.evaluate(document=>window.runtime.update({document}),documents[layout]);
      const host=page.locator(`[data-page-layout-form="${layout}"]`);
      await expect(host).toBeVisible();
      for(const container of ['default','plain','panel','card']) {
        const section=host.locator(`[data-section-id="${container}"]`);
        const title=section.locator(':scope > .section-title');
        const heading=section.locator('.page-heading-title');
        if(layout==='dashboard') {
          for(const item of [title,heading]) {
            await expect(item).toHaveCSS('font-size','16px');
            await expect(item).toHaveCSS('font-weight','500');
            await expect(item).toHaveCSS('color','rgb(25, 25, 25)');
            await expect(item).toHaveCSS('text-align','left');
          }
          expect(await title.evaluate(node=>getComputedStyle(node,'::before').content)).toBe('none');
          await expect(section.locator('[data-decorative-icon]:visible')).toHaveCount(0);
        } else {
          await expect(title).toHaveCSS('font-size',container==='panel'?'32px':'20px');
          await expect(title).toHaveCSS('text-align',container==='panel'?'center':'left');
          await expect(heading).toHaveCSS('font-size','32px');
          await expect(heading).toHaveCSS('text-align','center');
          await expect(section.locator('.page-heading [data-decorative-icon]:visible')).toHaveCount(2);
          if(container==='plain'||container==='default') {
            expect(await title.evaluate(node=>getComputedStyle(node,'::before').display)).toBe('inline-block');
          }
        }
      }
    }
    // Report专属的颜色和章节字号不得污染Dashboard标题。
    await page.evaluate(document=>window.runtime.update({document}),documents.dashboard);
    await page.locator('[data-page-layout-form]').evaluate(node=>{
      const style=(node as HTMLElement).style;
      style.setProperty('--mc-color-primary','rgb(255,0,255)');
      style.setProperty('--mc-color-report-text','rgb(255,0,255)');
      style.setProperty('--mc-section-title-font-size','80px');
    });
    for(const title of await page.locator('.section-title,.page-heading-title').all()) {
      await expect(title).toHaveCSS('font-size','16px');
      await expect(title).toHaveCSS('color','rgb(25, 25, 25)');
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  });
}
