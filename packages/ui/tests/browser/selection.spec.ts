import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/tests/browser/index.html?selection');});
test('tree single, local search, geometry and keyboard',async({page})=>{
 await page.getByRole('button',{name:'区域',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'搜索区域'})).toBeFocused();
 await page.getByRole('button',{name:'展开中国地区部'}).click();
 await expect(page.getByRole('button',{name:'深圳代表处',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'区域',exact:true})).toHaveCSS('height','32px');
 await expect(page.getByRole('textbox',{name:'搜索区域'})).toHaveCSS('border-top-width','0px');
 expect(await page.locator('.mc-ui-tree-node__children').first().evaluate(el=>({width:getComputedStyle(el,'::before').borderLeftWidth,color:getComputedStyle(el,'::before').borderLeftColor}))).toEqual({width:'1px',color:'rgb(240, 240, 240)'});
 await page.getByRole('textbox',{name:'搜索区域'}).fill(' bj ');
 await expect(page.getByRole('button',{name:'深圳代表处',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('变更次数')).toHaveText('0');
 await page.getByRole('button',{name:'北京代表处',exact:true}).click();
 await expect(page.getByLabel('值',{exact:true})).toHaveText('["BJ"]');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'区域',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'区域',exact:true}).press('ArrowDown');
 await page.getByRole('textbox',{name:'搜索区域'}).press('ArrowDown');
 await page.getByRole('button',{name:'中国地区部',exact:true}).press('ArrowRight');
 await page.getByRole('dialog').press('Escape');
 await page.getByRole('checkbox',{name:'搜索',exact:true}).uncheck();await page.getByRole('button',{name:'区域',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'搜索区域'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'中国地区部',exact:true})).toBeFocused();
 await page.screenshot({path:test.info().outputPath('tree-single.png')});
});
test('tags keep height, scroll and delete exactly one; disabled and states',async({page})=>{
 await page.getByRole('checkbox',{name:'多选',exact:true}).check();
 await page.getByLabel('规则').selectOption('descendants');
 await page.getByRole('button',{name:'区域',exact:true}).press('ArrowDown');
 const half=page.locator('.selection-check.is-indeterminate').first();
 await expect(half.locator('path')).toHaveCount(2);
 await expect(half.locator('path').last()).toHaveCSS('fill','rgb(255, 255, 255)');
 await expect(half.locator('path').first()).toHaveCSS('fill','rgb(20, 118, 255)');
 expect(await page.locator('.selection-check path').evaluateAll(paths=>paths.every(path=>/^[Mm]/.test(path.getAttribute('d')??'')))).toBe(true);
 await page.getByRole('dialog').press('Escape');
 const control=page.locator('.mc-selection').first();const before=await control.boundingBox();
 await page.getByRole('button',{name:'装载多标签'}).click();
 const tags=page.getByRole('group',{name:'区域已选标签'});
 expect((await control.boundingBox())?.height).toBe(before?.height);
 expect(await tags.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 await tags.locator('.tag-label').first().hover();await page.mouse.wheel(0,1000);await expect.poll(()=>tags.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'移除区域：UNKNOWN-LONG-CODE',exact:true}).click();
 await expect(page.getByLabel('值',{exact:true})).toHaveText('["SZ","BJ","DE"]');
 await page.getByRole('checkbox',{name:'禁用',exact:true}).check();await expect(page.getByRole('button',{name:'区域',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'移除区域：中国地区部 / 深圳代表处'})).toBeDisabled();
 await page.getByRole('checkbox',{name:'禁用',exact:true}).uncheck();
 for(const status of ['候选项加载中…','无候选项','候选项不可用','候选项加载失败(UNKNOWN)']){
  await page.getByLabel('候选状态').selectOption({label:status});await page.getByRole('button',{name:'区域',exact:true}).press('ArrowDown');await expect(page.getByRole('dialog').getByText(status,{exact:true})).toBeVisible();await page.getByRole('dialog').press('Escape');
 }
 await page.setViewportSize({width:390,height:720});await page.getByLabel('候选状态').selectOption({label:'正常'});await page.getByRole('button',{name:'区域',exact:true}).press('ArrowDown');
 const rect=await page.getByRole('dialog').boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(390);
});

for(const shadow of [false,true]) test(`mouse tag, blank frame, clear and empty arrow; shadow=${shadow}`,async({page})=>{
 if(shadow) await page.goto('/tests/browser/index.html?selection&shadow');
 await page.getByRole('checkbox',{name:'多选',exact:true}).check();
 const tag=page.getByRole('group',{name:'区域已选标签'}).getByRole('button',{name:'打开区域：中国地区部 / 深圳代表处'});
 const popup=page.getByRole('dialog',{name:'区域候选'});
 await tag.click();await expect(popup).toBeVisible();await expect(page.getByRole('textbox',{name:'搜索区域'})).toBeFocused();
 await tag.click();await expect(popup).toHaveCount(0);
 const trigger=page.getByRole('button',{name:'区域',exact:true});
 await trigger.click({position:{x:2,y:16}});await expect(popup).toBeVisible();
 await trigger.click({position:{x:2,y:16}});await expect(popup).toHaveCount(0);
 await expect(page.getByLabel('变更次数')).toHaveText('0');
 await tag.hover();await page.getByRole('button',{name:'清空区域',exact:true}).click();await expect(popup).toHaveCount(0);
 await expect(page.getByLabel('值',{exact:true})).toHaveText('[]');
 await trigger.click({position:{x:220,y:16}});await expect(popup).toBeVisible();await popup.press('Escape');
 await page.getByRole('button',{name:'装载多标签'}).click();await page.getByRole('checkbox',{name:'禁用',exact:true}).check();
 await expect(page.getByRole('button',{name:/^打开区域：/}).first()).toBeDisabled();
 await expect(popup).toHaveCount(0);
});

test('official geometry, neutral tag colors, icons and panel rows',async({page})=>{
 const trigger=page.getByRole('button',{name:'区域',exact:true});const control=page.locator('.mc-selection').first();
 const arrow=control.locator('.selection-arrow svg');
 await page.getByRole('heading').hover();await expect(arrow).toBeVisible();await expect(arrow).toHaveCSS('width','16px');await expect(arrow).toHaveCSS('height','16px');
 await expect(arrow).toHaveCSS('color','rgb(128, 128, 128)');
 expect(await control.locator('.selection-input').evaluate(el=>el.getBoundingClientRect().height)).toBe(32);
 const boxes=await control.evaluate(el=>{const a=el.querySelector('.selection-arrow svg')!.getBoundingClientRect(),r=el.getBoundingClientRect();return {icon:a.y+a.height/2,input:r.y+r.height/2};});expect(boxes.icon).toBe(boxes.input);
 await expect(trigger).toHaveCSS('border-radius','6px');
 await page.getByRole('checkbox',{name:'多选',exact:true}).check();
 const tag=control.locator('.mc-ui-tag').first();await expect(tag).toHaveCSS('background-color','rgb(245, 245, 245)');await expect(tag).toHaveCSS('color','rgb(25, 25, 25)');await expect(tag).toHaveCSS('height','24px');await expect(tag).toHaveCSS('font-size','12px');
 await page.getByRole('button',{name:'打开区域：中国地区部 / 深圳代表处'}).click();
 const search=page.getByRole('textbox',{name:'搜索区域'});await expect(search).toHaveCSS('padding-left','20px');
 const panel=page.getByRole('dialog',{name:'区域候选'});const geometry=await panel.evaluate(el=>{const p=el.getBoundingClientRect(),s=el.querySelector('input')!.getBoundingClientRect();return {left:s.left-p.left,right:p.right-s.right};});expect(geometry).toEqual({left:16,right:16});
 await panel.press('Escape');await page.getByRole('button',{name:'普通单选',exact:true}).click();
 await expect(page.getByRole('option',{name:'选项 A',exact:true})).toHaveCSS('height','32px');
});

for(const shadow of [false,true]) test(`tree content inset is16px; shadow=${shadow}`,async({page})=>{
 if(shadow) await page.goto('/tests/browser/index.html?selection&shadow');
 await page.getByRole('button',{name:'区域',exact:true}).click();
 const popup=page.getByRole('dialog',{name:'区域候选'});
 const treeInset=()=>popup.evaluate(el=>el.querySelector('.expand')!.getBoundingClientRect().left-el.getBoundingClientRect().left);
 expect(await treeInset()).toBe(16);
 await page.getByRole('button',{name:'展开中国地区部',exact:true}).click();expect(await treeInset()).toBe(16);
});
