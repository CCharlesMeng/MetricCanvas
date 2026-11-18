import {expect,test} from '@playwright/test';

for(const state of ['candidate-pending','candidate-error','empty']){
  test(`exclusion candidates ${state} do not block the chart`,async({page})=>{
    await page.goto(`/pages/filter-exclusion-candidates?state=${state}`);
    const chart=page.locator('article .widget-content').filter({has:page.locator('.echart')});
    await expect(chart).toHaveAttribute('aria-busy','false');
    await expect(chart).not.toHaveAttribute('inert','');
    await expect(page.locator('[data-filter-confirmation]')).toHaveCount(0);
    const group=page.locator('[data-filter-group="service"]');
    await group.getByRole('button',{name:'云服务排除项',exact:true}).click();
    if(state==='candidate-error')await expect(group.getByRole('button',{name:'重试',exact:true})).toBeVisible();
    if(state==='empty')await expect(group.getByRole('status')).toHaveText('无候选项');
    await expect(chart).toHaveAttribute('aria-busy','false');
  });
}
test('retains a missing exclusion in the standard selection control until the user removes it',async({page})=>{
  await page.goto('/pages/filter-exclusion-candidates');
  const group=page.locator('[data-filter-group="service"]');
  await group.getByRole('button',{name:'云服务排除项',exact:true}).click();
  await group.getByRole('option',{name:'甲云服务01',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'范围',exact:true}).click();
  await page.getByRole('option',{name:'乙',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(group.getByRole('button',{name:'移除云服务排除项：甲云服务01'})).toBeVisible();
  await expect(page.locator('[data-filter-confirmation]')).toHaveCount(0);
  await expect(page.getByText('当前范围无此项')).toHaveCount(0);
  await group.locator('button[aria-haspopup]').first().click();
  await expect(group.getByRole('option',{name:'乙云服务01',exact:true})).toBeVisible();
  await expect(group.getByRole('option',{name:'甲云服务01',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await group.getByRole('button',{name:'移除云服务排除项：甲云服务01'}).click();
  await expect(group.getByRole('button',{name:'移除云服务排除项：甲云服务01'})).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('service')).toBe(false);
});
