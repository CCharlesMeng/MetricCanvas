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

test('applies a conditional preset while the candidate window is pending',async({page})=>{
  await page.goto('/pages/filter-conditional-exclusion-default?state=candidate-pending');
  const chart=page.locator('article .widget-content').filter({has:page.locator('.echart')});
  const group=page.locator('[data-filter-group="service"]');
  const preset=group.getByRole('button',{name:'移除云服务排除项：预设专属服务'});
  await expect(preset).toBeAttached();
  await expect(group.getByRole('group',{name:'云服务排除项已选标签'}).getByText('云服务排除项',{exact:true})).toHaveCount(0);
  const trigger = group.getByRole('button',{name:'云服务排除项',exact:true});
  await expect(trigger).toBeVisible();
  const rect = (await trigger.boundingBox())!;
  await page.mouse.click(rect.x + rect.width - 18, rect.y + rect.height / 2);
  const dialog = group.getByRole('dialog',{name:'云服务排除项候选'});
  await expect(dialog).toHaveAttribute('aria-busy','true');
  await expect(dialog.getByRole('status')).toHaveText('候选项加载中，已选项可先调整');
  await expect(chart).toHaveAttribute('aria-busy','false');
  await expect(dialog.getByText('云服务排除项',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('option',{name:'预设专属服务',exact:true,selected:true})).toBeVisible();
  await dialog.getByRole('option',{name:'甲云服务01',exact:true,selected:true}).click();
  await expect(dialog.getByRole('option',{name:'甲云服务01',exact:true})).toHaveCount(0);
  await expect(dialog).toHaveAttribute('aria-busy','true');
  expect(new URL(page.url()).searchParams.getAll('service')).toEqual(['预设专属服务']);
  await expect(chart).toHaveAttribute('aria-busy','false');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'范围',exact:true}).click();
  await page.getByRole('option',{name:'乙',exact:true}).click();
  await expect(group.getByRole('button',{name:'移除云服务排除项：甲云服务01'})).toBeAttached();
  await expect(preset).toBeAttached();
  await page.getByRole('button',{name:'范围',exact:true}).click();
  await page.getByRole('option',{name:'丙',exact:true}).click();
  await expect(preset).toHaveCount(0);
  await expect(chart).toHaveAttribute('aria-busy','false');
  await page.goto('/pages/filter-conditional-exclusion-default?service=');
  await expect(page.getByRole('button',{name:'范围',exact:true})).toHaveText('甲');
  await expect(preset).toHaveCount(0);
});

test('an empty candidate response leaves configured exclusions selected and clearable in the popup', async ({page}) => {
  await page.goto('/pages/filter-conditional-exclusion-default?state=empty');
  const group = page.locator('[data-filter-group="service"]');
  const clear = group.getByRole('button',{name:'清空云服务排除项',exact:true});
  await expect(clear).toBeHidden();
  await group.getByRole('button',{name:'云服务排除项',exact:true}).press('ArrowDown');
  const dialog = group.getByRole('dialog',{name:'云服务排除项候选'});
  await expect(dialog.getByRole('status')).toHaveText('暂无可添加的候选项');
  await expect(dialog.getByRole('option',{selected:true})).toHaveCount(2);
  await expect(dialog.getByRole('option',{name:'预设专属服务',exact:true})).toHaveAttribute('aria-selected','true');
  await dialog.getByRole('textbox').press('Tab');
  await expect(clear).toBeFocused();
  await clear.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('option',{selected:true})).toHaveCount(0);
  await expect(dialog.getByRole('textbox')).toBeFocused();
  expect(new URL(page.url()).searchParams.get('service')).toBe('');
});

test('shows each selected exclusion once when the candidates arrive',async({page})=>{
  await page.goto('/pages/filter-conditional-exclusion-default');
  const group=page.locator('[data-filter-group="service"]');
  await group.getByRole('button',{name:'打开云服务排除项：甲云服务01'}).click();
  const dialog = group.getByRole('dialog',{name:'云服务排除项候选'});
  const firstCandidate = dialog.getByRole('option',{name:'甲云服务25',exact:true});
  await expect(firstCandidate).toBeVisible();
  await expect(dialog.getByRole('option',{name:'预设专属服务',exact:true,selected:true})).toBeVisible();
  await dialog.getByRole('textbox',{name:'搜索云服务排除项'}).fill('01');
  await expect(firstCandidate).toHaveCount(0);
  await expect(dialog).toHaveAttribute('aria-busy','false');
  const selectedCandidate = dialog.getByRole('option',{name:'甲云服务01',exact:true});
  await expect(selectedCandidate).toHaveCount(1);
  await expect(selectedCandidate).toHaveAttribute('aria-selected','true');
  await selectedCandidate.click();
  await expect(selectedCandidate).toHaveAttribute('aria-selected','false');
});
