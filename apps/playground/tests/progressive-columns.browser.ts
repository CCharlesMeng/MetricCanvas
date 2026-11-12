import { expect, test } from '@playwright/test';

test('selected columns appear first; a failed supplement keeps them and prevents export',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/progressive-columns-review');
  const table=page.locator('.table-widget');
  await expect(table.getByRole('cell',{name:'测试项目1',exact:true})).toBeVisible();
  await expect(table).toHaveAttribute('aria-busy','true');
  await expect(table.locator('tbody')).toHaveAttribute('inert','');
  await expect(table.locator('tbody tr').first()).toContainText('--');
  await expect(table.locator('.loading-spinner')).toHaveCount(0);
  await expect(table.getByRole('button',{name:'导出',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'返回下一批补列',exact:true}).click();
  await expect(table).toHaveAttribute('aria-busy','true');
  await expect(table.getByRole('cell',{name:'进行中',exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'返回下一批补列',exact:true}).click();
  await expect(table).toHaveAttribute('aria-busy','false');

  await page.getByRole('checkbox',{name:'暂停选页请求'}).check();
  await table.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(table.getByRole('cell',{name:'测试项目1',exact:true})).toBeVisible();
  await expect(table.getByRole('cell',{name:'进行中',exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'返回选页结果',exact:true}).click();
  await expect(table.getByRole('cell',{name:'测试项目11',exact:true})).toBeVisible();
  await expect(table.getByRole('cell',{name:'进行中',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'补列失败',exact:true}).click();
  await expect(table).toHaveAttribute('aria-busy','false');
  await expect(table.getByRole('cell',{name:'测试项目11',exact:true})).toBeVisible();
  await expect(table.locator('tbody tr').first()).toContainText('--');
  await expect(table.getByRole('button',{name:'导出',exact:true})).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a supplement that owns sorting selects the page before any rows are displayed',async({page})=>{
  await page.goto('/progressive-columns-review');
  const table=page.locator('.table-widget');
  await page.getByRole('button',{name:'返回下一批补列',exact:true}).click();
  await page.getByRole('button',{name:'返回下一批补列',exact:true}).click();
  await expect(table).toHaveAttribute('aria-busy','false');
  await table.getByRole('columnheader',{name:'合同金额',exact:false}).getByRole('button',{name:'合同金额',exact:true}).click();
  await expect(table).toHaveAttribute('aria-busy','true');
  // The earlier complete view is retained until the sorting member returns its correct keys.
  await expect(table.getByRole('cell',{name:'测试项目1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'返回下一批补列',exact:true}).click();
  await expect(table).toHaveAttribute('aria-busy','false');
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('checkbox',{name:'暂停选页请求'}).check();
  await table.getByRole('columnheader',{name:'合同金额',exact:false}).getByRole('button',{name:/合同金额/}).click();
  await page.getByRole('button',{name:'返回下一批补列',exact:true}).click();
  await expect(table.getByRole('cell',{name:'P000080',exact:true})).toBeVisible();
  await expect(table.getByRole('cell',{name:'测试项目1',exact:true})).toHaveCount(0);
  await expect(table).toHaveAttribute('aria-busy','true');
  await page.getByRole('button',{name:'返回选页结果',exact:true}).click();
  await page.getByRole('button',{name:'返回选页结果',exact:true}).click();
  await expect(table.getByRole('cell',{name:'测试项目80',exact:true})).toBeVisible();
  await expect(table).toHaveAttribute('aria-busy','false');
});
