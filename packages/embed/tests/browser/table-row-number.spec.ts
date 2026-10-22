import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const fixture = () => JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-row-number.json', import.meta.url), 'utf8'));
async function mount(page: import('@playwright/test').Page, document = fixture()) {
  await page.goto('/examples/inline.html');
  await page.evaluate(document => { window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', { document }); }, document);
}
const main = (page: import('@playwright/test').Page) => page.locator('[data-component="main/records-table"]');
const numbers = (table: import('@playwright/test').Locator) => table.locator('tbody > tr > td[data-row-number]');

test('local pagination, sorting, search, range filters and full Excel export share the row order', async ({ page }) => {
  await mount(page); const table = main(page);
  await expect(numbers(table)).toHaveText(Array.from({length:10}, (_,i)=>String(i+1)));
  await table.getByRole('button', {name:'2',exact:true}).click(); await expect(numbers(table).first()).toHaveText('11');
  await table.getByRole('button', {name:/^金额/}).click();
  await table.getByRole('button', {name:/^金额/}).click();
  await expect(numbers(table).first()).toHaveText('1');
  await expect(table.locator('tbody tr').first()).toContainText('客户25');
  await table.getByRole('searchbox').fill('客户2'); await table.getByRole('searchbox').press('Enter');
  await expect(numbers(table)).toHaveText(['1','2','3','4','5','6','7']);
  const downloaded = page.waitForEvent('download'); await table.getByRole('button', {name:'导出',exact:true}).click();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await (await downloaded).path())!);
  const sheet = workbook.worksheets[0]; expect(sheet.getCell('A1').value).toBe('序号');
  expect(sheet.getCell('A3').value).toBe(1); expect(sheet.getCell('B3').value).toBe('客户25'); expect(sheet.getCell('A9').value).toBe(7);
  await table.getByRole('button',{name:'清空表格搜索'}).click();
  await table.getByTitle('表头筛选').click(); await table.getByLabel('数值下限').fill('24'); await table.getByLabel('数值下限').press('Tab');
  await expect(numbers(table)).toHaveText(['1','2']); await expect(table.locator('tbody tr').first()).toContainText('客户25');
});

test('all variants, multi-level headers, empty results and narrow fixed columns preserve the column grid', async ({ page }, info) => {
  await page.setViewportSize({width:390,height:900}); await mount(page); const table = main(page);
  await expect(table.locator('th[data-row-number]')).toHaveAttribute('rowspan','2');
  for (const id of ['embedded','forecast-matrix','report-compact']) {
    const table = page.locator(`[data-component="${id}/${id}-table"]`);
    await expect(table.locator('th[data-row-number]')).toHaveText('编号'); await expect(numbers(table)).toHaveText(['1','2','3']);
  }
  const empty = page.locator('[data-component="empty/empty-table"]');
  await expect(empty.locator('th[data-row-number]')).toHaveText('序号'); await expect(numbers(empty)).toHaveCount(0);
  await expect(empty.locator('td.empty-row')).toHaveAttribute('colspan','3');
  const cells = table.locator('tbody tr').first();
  const rowNumber = await cells.locator('td').nth(0).boundingBox(), customer = await cells.locator('td').nth(1).boundingBox();
  expect(customer!.x).toBeGreaterThanOrEqual(rowNumber!.x + rowNumber!.width - 1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('row-number-narrow.png'),fullPage:true});
});

test('query pagination uses the current window offset without adding a query field', async ({page}) => {
  const document = fixture(), rows = document.dataSources.records.source.rows;
  document.sections = document.sections.slice(0,1);
  document.dataSources.records.fields.name.queryField='客户'; document.dataSources.records.fields.value.queryField='金额';
  document.dataSources.records.source={type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:['客户'],output_metrics:['金额'],order:{offset:0,limit:10}}]}}};
  document.sections[0].components[0].props.pagination={mode:'query'};
  delete document.sections[0].components[0].props.toolbar;
  await page.goto('/examples/inline.html');
  await page.evaluate(({document,rows})=>{
    window.runtime.destroy(); window.runtime=MetricCanvas.mount('#dashboard',{document,dataGateway:{async fetchData(query){
      const {offset=0,limit=10}=query.pagination??{};
      if (Object.keys(query.fieldMappings).some(key=>key==='rowNumber')) throw new Error('Synthetic query field');
      return {rows:rows.slice(offset,offset+limit),totalCount:rows.length};
    }}});
  },{document,rows});
  await expect(numbers(main(page)).first()).toHaveText('1');
  await main(page).getByRole('button',{name:'下一页',exact:true}).click();
  await expect(numbers(main(page)).first()).toHaveText('11');
  await expect(main(page).locator('tbody tr').first()).toContainText('客户11');
});

test('parent expansion spans the generated column and children number independently', async ({page})=>{
  const document=JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-row-expansion-inline.json',import.meta.url),'utf8'));
  document.schemaVersion='6.48'; document.sections=document.sections.slice(0,1);
  const props=document.sections[0].components[0].props; props.rowNumber={fixed:'left'}; props.rowExpansion.table.rowNumber={};
  await mount(page,document); const table=page.locator('article').first();
  await table.getByRole('button',{name:'展开子表格',exact:true}).first().click();
  await expect(table.locator('td.row-expansion-cell')).toHaveAttribute('colspan',String(props.columns.length+2));
  const child=table.getByRole('region',{name:'子表格',exact:true});
  await expect(numbers(child).first()).toHaveText('1');
  await child.getByRole('button',{name:'2',exact:true}).click(); await expect(numbers(child).first()).toHaveText('11');
  await expect(table.locator('table').first().locator(':scope > tbody > tr > td[data-row-number]').first()).toHaveText('1');
});
