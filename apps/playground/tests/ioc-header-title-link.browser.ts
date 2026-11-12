import { expect, test } from '@playwright/test';

const source='/pages/ioc-header-title-link?project=P002';

test('title keeps its typography and navigates with page parameters and the applied filter',async({page})=>{
  await page.goto(source);
  const link=page.locator('[data-ioc-title] a');
  await expect(link).toHaveAttribute('href',/project=P002#details$/);
  await expect(link).toHaveCSS('font-size','24px');
  await expect(link).toHaveCSS('font-weight','700');
  await page.getByRole('checkbox',{name:'已审核',exact:true}).check();
  await expect(link).toHaveAttribute('href',/project=P002.*reviewed=true#details$/);
  await link.click();
  await expect(page).toHaveURL(/ioc-header-title-link-target\?source=header&project=P002&reviewed=true#details$/);
  await expect(page.getByText('P002',{exact:true})).toBeVisible();
  await expect(page.getByText('已审核：true',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'返回上一页',exact:true}).click();
  await expect(page.locator('[data-ioc-title] a')).toBeVisible();
  await expect(page).toHaveURL(/ioc-header-title-link\?project=P002/);
});

test('keyboard activation uses the existing navigation and target validation',async({page})=>{
  await page.goto(source);
  const link=page.locator('[data-ioc-title] a');
  await expect(link).toHaveAttribute('href',/project=P002#details$/);
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/ioc-header-title-link-target.*project=P002/);
});

test('conditional links preserve the title text while disabled or hidden',async({page})=>{
  await page.goto(source);
  await expect(page.locator('[data-ioc-title] a')).toHaveAttribute('href',/project=P002/);
  await page.getByRole('checkbox',{name:'允许标题跳转',exact:true}).uncheck();
  await expect(page.locator('[data-ioc-title] a')).toHaveCount(0);
  await expect(page.locator('[data-ioc-title] [aria-disabled=true]')).toHaveText('经营概览');
  await page.getByRole('checkbox',{name:'允许标题跳转',exact:true}).check();
  await expect(page.locator('[data-ioc-title] a')).toBeVisible();
  await page.getByRole('checkbox',{name:'显示标题链接',exact:true}).uncheck();
  await expect(page.locator('[data-ioc-title] a')).toHaveCount(0);
  await expect(page.locator('[data-ioc-title]')).toHaveText('经营概览');
  await page.getByRole('checkbox',{name:'显示标题链接',exact:true}).check();
  await expect(page.locator('[data-ioc-title] a')).toBeVisible();
});

test('a title link can open a new tab with its fully resolved URL',async({page,context})=>{
  await page.goto(source);
  const link=page.locator('[data-ioc-title] a');
  await expect(link).toHaveAttribute('href',/project=P002#details$/);
  const opened=context.waitForEvent('page');
  await link.click({modifiers:[process.platform==='darwin'?'Meta':'Control']});
  const target=await opened;
  await expect(target).toHaveURL(/ioc-header-title-link-target.*project=P002/);
  await expect(page).toHaveURL(/ioc-header-title-link\?project=P002/);
});
