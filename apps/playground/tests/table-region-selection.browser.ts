import {expect,test,type Page} from '@playwright/test';
import {chooseTree,closeSelection,openSelection} from '../../../packages/embed/tests/browser/selection-actions';

type Receipt=Array<{target:string;queryField?:string;values?:string[]}>;
type ReceiptWindow=Window & {headerControlCalls:Receipt[]};
const calls=(page:Page)=>page.evaluate(()=>(window as ReceiptWindow).headerControlCalls);

test('table selection uses Header Region state, levels and existing query bindings',async({page})=>{
  await page.addInitScript(()=>{
    const receipts:Receipt[]=[];
    Object.assign(window,{headerControlCalls:receipts});
    window.addEventListener('metriccanvas:synthetic-header-controls',event=>receipts.push((event as CustomEvent<Receipt>).detail));
  });
  await page.goto('/pages/ioc-header-controls?keep=retained');
  const entry=page.locator('[data-component="main/organization-entry"]');
  const results=page.locator('[data-component="main/results"]');
  const region=page.locator('[data-filter-id="region"]');
  const year=page.locator('[data-filter-id="stat-year"]');
  await expect(results).toContainText('全球（当前范围不限）');
  await entry.getByRole('button',{name:'上海代表处',exact:true}).click();
  await expect(region).toContainText('上海代表处');
  await expect(results).toContainText('上海代表处');
  await expect(entry.getByRole('button',{name:'上海代表处',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(entry.locator('tbody tr')).toHaveCount(3);
  expect(new URL(page.url()).searchParams.get('rep-office')).toBe('上海代表处');
  expect((await calls(page)).at(-1)).toContainEqual({target:'dimension',queryField:'代表处',values:['上海代表处']});
  const count=(await calls(page)).length;
  await entry.getByRole('button',{name:'上海代表处',exact:true}).click();
  expect(await calls(page)).toHaveLength(count);

  await chooseTree(region,'华北地区部');await closeSelection(region);
  await expect(results).toContainText('华北地区部');
  await expect(entry.getByRole('button',{name:'华北地区部',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(entry.getByRole('button',{name:'上海代表处',exact:true})).toHaveAttribute('aria-pressed','false');
  expect((await calls(page)).at(-1)).toContainEqual({target:'dimension',queryField:'地区部',values:['华北地区部']});

  await entry.getByRole('button',{name:'同码代表处',exact:true}).press('Enter');
  await expect(region).toContainText('同码代表处');
  await expect(entry.getByRole('button',{name:'同码代表处',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(entry.getByRole('button',{name:'同码地区部',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect.poll(async()=>(await calls(page)).at(-1)).toContainEqual({target:'dimension',queryField:'代表处',values:['SAME']});
  await entry.getByRole('button',{name:'同码地区部',exact:true}).click();
  await expect(region).toContainText('同码地区部');
  await expect(entry.getByRole('button',{name:'同码地区部',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(entry.getByRole('button',{name:'同码代表处',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect.poll(async()=>(await calls(page)).at(-1)).toContainEqual({target:'dimension',queryField:'地区部',values:['SAME']});
  await openSelection(region);await region.getByRole('button',{name:'清空区域',exact:true}).click();await closeSelection(region);
  await expect(results).toContainText('全球（当前范围不限）');
  await expect(entry.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await expect(year.getByRole('combobox')).toHaveValue('2026 年');
  expect(new URL(page.url()).searchParams.get('keep')).toBe('retained');
});
