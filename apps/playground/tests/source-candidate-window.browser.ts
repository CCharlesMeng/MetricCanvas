import { expect, test, type Locator, type Page } from '@playwright/test';

type WindowRequest = { kind:'page'|'selection'; offset:number; limit:number };

async function openMenu(page:Page, state='ready') {
  await page.addInitScript(() => {
    const requests:WindowRequest[] = [];
    Object.assign(window, {candidateWindows:requests});
    window.addEventListener('metriccanvas:source-candidate-window', event => requests.push((event as CustomEvent<WindowRequest>).detail));
  });
  await page.goto(`/pages/filter-source-query-pagination?state=${state}`);
  const requestWindows = () => page.evaluate(() => (window as unknown as {candidateWindows:WindowRequest[]}).candidateWindows
    .filter(request => request.kind === 'page').map(({offset,limit}) => [offset,limit]));
  const group = page.locator('[data-filter-group="service"]');
  const trigger = group.getByRole('button',{name:'云服务排除项',exact:true});
  await expect(trigger).toBeVisible();
  expect(await requestWindows()).toEqual([]);
  await trigger.click();
  const menu = group.getByRole('dialog',{name:'云服务排除项候选'});
  return {group, menu, list:menu.getByRole('listbox'), requestWindows};
}

async function scrollToEnd(list:Locator) {
  await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
}

test('requests one candidate window, loads more on scroll and keeps exclusions across search',async({page})=>{
  const {group,menu,list,requestWindows} = await openMenu(page);
  await expect(list.getByRole('option',{name:'甲云服务10',exact:true})).toBeVisible();
  expect(await requestWindows()).toEqual([[0,10]]);
  await expect(list.getByRole('option',{name:'全选'})).toHaveCount(0);
  await scrollToEnd(list);
  const choice = list.getByRole('option',{name:'甲云服务12',exact:true});
  await expect(choice).toBeVisible();
  expect(await requestWindows()).toEqual([[0,10],[10,10]]);
  await choice.click();
  await expect(group.getByRole('button',{name:'移除云服务排除项：甲云服务12'})).toBeVisible();
  await menu.getByRole('textbox').fill('25');
  await expect(list.getByRole('option',{name:'甲云服务25',exact:true})).toBeVisible();
  await expect(list.getByRole('option')).toHaveCount(1);
  expect(await requestWindows()).toEqual([[0,10],[10,10],[0,10]]);
  await expect(group.getByRole('button',{name:'移除云服务排除项：甲云服务12'})).toBeVisible();
  await menu.getByRole('textbox').fill('');
  await expect(list.getByRole('option',{name:'甲云服务10',exact:true})).toBeVisible();
  await scrollToEnd(list);
  await expect(list.getByRole('option',{name:'甲云服务20',exact:true})).toBeVisible();
  await scrollToEnd(list);
  await expect(list.getByRole('option',{name:'全选'})).toBeVisible();
  expect(await requestWindows()).toEqual([[0,10],[10,10],[0,10],[0,10],[10,10],[20,10]]);
  await menu.getByRole('textbox').press('Escape');
  await page.getByRole('button',{name:'范围',exact:true}).click();
  await page.getByRole('option',{name:'乙',exact:true}).click();
  await expect(group.getByRole('button',{name:'移除云服务排除项：甲云服务12'})).toHaveCount(0);
  await group.getByRole('button',{name:'云服务排除项',exact:true}).click();
  await expect(list.getByRole('option',{name:'乙云服务01',exact:true})).toBeVisible();
  await expect(list.getByRole('option',{name:'甲云服务01',exact:true})).toHaveCount(0);
});

test('retries the failed window without discarding visible choices',async({page})=>{
  const {menu,list,requestWindows} = await openMenu(page, 'page-failure');
  await expect(list.getByRole('option',{name:'甲云服务10',exact:true})).toBeVisible();
  await scrollToEnd(list);
  await expect(menu.getByRole('alert')).toHaveText('后续候选项加载失败');
  await expect(list.getByRole('option',{name:'甲云服务01',exact:true})).toBeVisible();
  await menu.getByRole('button',{name:'重试'}).click();
  await expect(list.getByRole('option',{name:'甲云服务20',exact:true})).toBeVisible();
  expect(await requestWindows()).toEqual([[0,10],[10,10],[10,10]]);
});

test('shows an empty candidate window and does not request a continuation',async({page})=>{
  const {menu,requestWindows} = await openMenu(page, 'empty');
  await expect(menu.getByRole('status')).toHaveText('无候选项');
  expect(await requestWindows()).toEqual([[0,10]]);
});
