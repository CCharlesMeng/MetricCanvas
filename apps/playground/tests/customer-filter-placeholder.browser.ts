import {readFileSync} from 'node:fs';
import {test, expect} from '@playwright/test';

const document = JSON.parse(readFileSync(new URL('../../../pages/capabilities/ioc-header/business/ioc-header-demo.json', import.meta.url), 'utf8'));
const filter = document.filters.find((candidate: {id: string}) => candidate.id === 'customer-type');
const placeholder = '请选择客户分类';
const allSelected = '全部客户分类';

test('customer placeholder stays in the trigger through selection and clearing', async ({page}) => {
  await page.goto('/pages/ioc-header-demo');
  const trigger = page.getByRole('button', {name: filter.label, exact: true});
  const popup = page.getByRole('dialog', {name: `${filter.label}候选`});
  await expect(trigger).toHaveText(placeholder);
  await trigger.click();
  await expect(popup).toBeVisible();
  await expect(popup.getByText(placeholder, {exact: true})).toHaveCount(0);
  await expect(popup.getByRole('button', {name: '清除筛选', exact: true})).toHaveCount(0);
  const option = filter.options[0];
  await popup.getByRole('option', {name: option.label, exact: true}).click();
  await expect(popup.getByRole('option', {name: option.label, exact: true})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', {name: `打开${filter.label}：${option.label}`, exact: true})).toBeVisible();
  await popup.press('Escape');
  await trigger.hover();
  await page.getByRole('button', {name: `清空${filter.label}`, exact: true}).click();
  await expect(trigger).toHaveText(placeholder);
  await trigger.click();
  await expect(popup.getByText(placeholder, {exact: true})).toHaveCount(0);
  const search = popup.getByRole('textbox', {name: `搜索${filter.label}`});
  await search.fill(option.label);
  await expect(popup.getByRole('option')).toHaveCount(1);
  await search.fill('不存在的客户类型');
  await expect(popup.getByRole('status')).toHaveText('无匹配候选项');
  await expect(popup.getByText(placeholder, {exact: true})).toHaveCount(0);
});

test('all customer categories share one summary when the dropdown closes', async ({page}) => {
  await page.goto('/pages/ioc-header-demo');
  const trigger = page.getByRole('button', {name: filter.label, exact: true});
  const popup = page.getByRole('dialog', {name: `${filter.label}候选`});
  const tags = page.getByRole('group', {name: `${filter.label}已选标签`});
  const selectAll = popup.getByRole('option', {name: '全选', exact: true});
  const first = popup.getByRole('option', {name: filter.options[0].label, exact: true});

  await trigger.click();
  await selectAll.click();
  await popup.press('Escape');
  await expect(trigger).toHaveText(allSelected);
  await expect(tags).toHaveCount(0);

  await trigger.click();
  await expect(selectAll).toHaveAttribute('aria-selected', 'true');
  await expect(popup.locator('button[data-value][aria-selected="true"]')).toHaveCount(filter.options.length);
  await first.click();
  await popup.press('Escape');
  await expect(trigger).toHaveText('');
  await expect(tags.getByRole('button', {name: /^移除/})).toHaveCount(filter.options.length - 1);

  await trigger.press('ArrowDown');
  await first.click();
  await popup.press('Escape');
  await expect(trigger).toHaveText(allSelected);
  await trigger.hover();
  await page.getByRole('button', {name: `清空${filter.label}`, exact: true}).click();
  await expect(trigger).toHaveText(placeholder);
});

test('an explicit empty label takes precedence in an IOC enum dropdown', async ({page}) => {
  await page.goto('/pages/chart-customer-series');
  const trigger = page.getByRole('button', {name: '客户分类', exact: true});
  await expect(trigger).toHaveText('全部客户分类');
  await trigger.click();
  await expect(page.getByRole('option', {name: '全选', exact: true})).toHaveAttribute('aria-selected', 'false');
});
