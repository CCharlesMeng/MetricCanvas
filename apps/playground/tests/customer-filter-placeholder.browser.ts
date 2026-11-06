import {readFileSync} from 'node:fs';
import {test, expect} from '@playwright/test';

const document = JSON.parse(readFileSync(new URL('../../../pages/capabilities/ioc-header/business/ioc-header-demo.json', import.meta.url), 'utf8'));
const filter = document.filters.find((candidate: {id: string}) => candidate.id === 'customer-type');

test('customer placeholder stays in the trigger through selection and clearing', async ({page}) => {
  await page.goto('/pages/ioc-header-demo');
  const trigger = page.getByRole('button', {name: filter.label, exact: true});
  const popup = page.getByRole('dialog', {name: `${filter.label}候选`});
  await expect(trigger).toHaveText(filter.emptyLabel);
  await trigger.click();
  await expect(popup).toBeVisible();
  await expect(popup.getByText(filter.emptyLabel, {exact: true})).toHaveCount(0);
  await expect(popup.getByRole('button', {name: '清除筛选', exact: true})).toHaveCount(0);
  const option = filter.options[0];
  await popup.getByRole('option', {name: option.label, exact: true}).click();
  await expect(popup.getByRole('option', {name: option.label, exact: true})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', {name: `打开${filter.label}：${option.label}`, exact: true})).toBeVisible();
  await popup.press('Escape');
  await trigger.hover();
  await page.getByRole('button', {name: `清空${filter.label}`, exact: true}).click();
  await expect(trigger).toHaveText(filter.emptyLabel);
  await trigger.click();
  await expect(popup.getByText(filter.emptyLabel, {exact: true})).toHaveCount(0);
  const search = popup.getByRole('textbox', {name: `搜索${filter.label}`});
  await search.fill(option.label);
  await expect(popup.getByRole('option')).toHaveCount(1);
  await search.fill('不存在的客户类型');
  await expect(popup.getByRole('status')).toHaveText('无匹配候选项');
  await expect(popup.getByText(filter.emptyLabel, {exact: true})).toHaveCount(0);
});
