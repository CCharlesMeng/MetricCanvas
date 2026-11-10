import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const business = JSON.parse(readFileSync(new URL('../../../pages/partner-health.json',import.meta.url),'utf8'));
const fieldTypes = new Map<string,string>(Object.values(business.dataSources).flatMap((value: any)=>
  Object.values(value.fields).filter((field: any)=>field.queryField).map((field: any)=>[field.queryField,field.type] as [string,string])));

function simulatedResult(query: any) {
  const fields: string[] = query.output_fields ?? [...query.output_dims ?? [], ...query.output_metrics ?? []];
  const indices=[8,2,12,4,10,6,1,9,3,11,5,7];
  const data=indices.map(index=>Object.fromEntries(fields.map(field=>[field,
    field==='国内或海外'?'国内':field==='地区部'?`合成地区部${String(index).padStart(2,'0')}`:
      field==='代表处'?`合成代表处${String(index).padStart(2,'0')}`:fieldTypes.get(field)==='number'?index:`合成${field}`])));
  return {code:'SUCCESS',data,total_count:data.length};
}

test('the exact partner-health page sorts both computed tables locally and titles the clicked row',async({page})=>{
  test.setTimeout(60000);
  let requests=0;
  await page.route('**/dsl/execute',async route=>{
    requests++;
    const body=route.request().postDataJSON();
    await route.fulfill({json:{retCode:'CBC.0000',results:body.dsl_list.map(simulatedResult)}});
  });
  await page.goto('/pages/partner-health');
  for(const [grain,label] of [['region','地区部'],['representative','代表处']]){
    if(grain==='representative')await page.getByRole('tab',{name:label,exact:true}).last().click();
    const table=page.getByRole('table').first();
    await expect(table.locator('tbody tr').first()).toContainText(`合成${label}12`,{timeout:25000});
    const before=requests;
    const sort=table.getByRole('button',{name:/^伙伴健康度得分/});
    await sort.click();
    await expect(table.locator('tbody tr').first()).toContainText(`合成${label}08`);
    await sort.click();
    await expect(table.locator('tbody tr').first()).toContainText(`合成${label}01`);
    await sort.click();
    await expect(table.locator('tbody tr').first()).toContainText(`合成${label}12`);
    expect(requests).toBe(before);
    await table.locator('tbody tr').first().getByRole('button',{name:'12',exact:true}).first().click();
    await expect(page.getByRole('dialog').locator('[data-detail-title]')).toHaveText(grain==='region' ? `合成${label}12 · 伙伴声音闭环率(5%) · 当前值 12 · 明细` : `合成${label}12`);
    await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
  }
});

test('computed health scores sort before local pagination, compose row titles and paint totals', async ({page}) => {
  const calls: string[] = [];
  const errors: string[] = [];
  page.on('request',request=>{if(request.url().includes('/dsl/execute'))calls.push(request.url());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(() => {
    const paints: string[] = [];
    Object.assign(window,{healthTotalPaints:paints});
    const fillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(...args){paints.push(args[0]);return fillText.apply(this,args);};
  });
  await page.setViewportSize({width:1440,height:1100});
  await page.goto('/pages/partner-health-interactions');
  const table=page.locator('[data-component="main/region-table"]');
  await expect(table.getByRole('cell',{name:'合成地区部08',exact:true})).toBeVisible();
  const sort=table.getByRole('button',{name:/^伙伴健康度得分/});
  await sort.click();
  await expect(table.locator('tbody tr').first()).toContainText('合成地区部01');
  await table.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(table.locator('tbody tr').first()).toContainText('合成地区部11');
  await sort.click();
  await expect(table.locator('tbody tr').first()).toContainText('合成地区部12');
  await table.locator('tbody tr').first().getByRole('button').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('[data-detail-title]')).toHaveText('合成地区部12 · 伙伴声音闭环率(5%) · 当前值 12 · 明细');
  await dialog.getByRole('button',{name:'关闭',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'healthTotalPaints'))).toEqual(expect.arrayContaining(['36','29','39']));
  await page.screenshot({path:'/tmp/partner-health-interactions.png',fullPage:true});
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});
