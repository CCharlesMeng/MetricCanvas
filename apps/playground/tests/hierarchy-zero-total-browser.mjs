import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=process.env.PLAYGROUND_BASE_URL??'http://127.0.0.1:5194';
const output=process.argv[2]??'docs/evidence/hierarchy-zero-total-20261030';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[],warnings=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());});
  await page.goto(`${base}/pages/query-zero-total-hierarchy`);
  // The fixture may add a section prefix to the component identity.
  const parent=page.locator('[data-component]').filter({has:page.getByText('父表总数0，实际2行：可翻页、筛选和展开',{exact:true})}).last();
  await expect(parent.locator('tbody').first()).toContainText('甲地区部');
  await expect(parent.locator('tbody').first()).not.toContainText('乙地区部');
  await parent.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(parent.locator('tbody').first()).toContainText('乙地区部');
  await parent.getByRole('button',{name:'上一页',exact:true}).click();
  await parent.getByRole('button',{name:'展开子表格',exact:true}).click();
  await expect(parent.locator('tbody').first()).toContainText('甲代表处');
  await expect(parent.getByRole('region',{name:'子表格',exact:true}).getByRole('cell',{name:'7',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(output,'parent-child-zero-total.png'),fullPage:true});
  await parent.getByRole('button',{name:'收起子表格',exact:true}).click();
  await expect(parent.locator('tbody').first()).not.toContainText('甲代表处');
  await page.getByRole('button',{name:'地区范围',exact:true}).click();
  await page.getByRole('button',{name:'乙地区部',exact:true}).click();
  await expect(parent.locator('tbody').first()).toContainText('乙地区部');
  await expect(parent.locator('tbody').first()).not.toContainText('甲地区部');
  expect(warnings.some(message=>message.includes('TOTAL_COUNT_MISMATCH'))).toBe(true);
  expect(errors).toEqual([]);
  const result={base,scenario:'parent and expanded child return nonempty rows with total_count=0',passed:['parent rows','local parent pagination','child rows','collapse','parent selection','count warning'],pageErrors:errors,validation:'synthetic HTTP receipts; real DQE/Relay not exercised'};
  await writeFile(path.join(output,'browser-result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}finally{await browser.close();}
