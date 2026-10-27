import {chromium, expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ExcelJS=createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const base=process.env.PERIOD_POLICY_BASE_URL??'http://127.0.0.1:5198';
const editorBase=process.env.PERIOD_EDITOR_BASE_URL??'http://127.0.0.1:5199';
const output=process.argv[2]??'/tmp/metriccanvas-period-policy/browser';
const fixture=JSON.parse(await readFile(new URL('../../../pages/capabilities/filters/period-query-columns-demo.json',import.meta.url),'utf8'));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
const errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{
  if(request.method()==='POST'&&request.url().endsWith('/dsl/execute'))requests.push(JSON.parse(request.postData()).dsl_list);
});
const main=()=>page.locator('.table-widget').filter({has:page.getByRole('heading',{name:fixture.sections[0].components[0].props.title,exact:true})});
async function changeMode(label,column){
  await page.getByRole('button',{name:label,exact:true}).click();
  await expect(main().getByRole('columnheader',{name:column,exact:true})).toBeVisible();
}
async function projectedColumns(){
  await page.goto(`${base}/pages/${fixture.id}`);
  await expect(main().getByRole('columnheader',{name:'月度得分',exact:true})).toBeVisible();
  await expect.poll(()=>requests.flat().filter(item=>item.filter.time.period==='day').length).toBeGreaterThan(0);
  await expect.poll(()=>requests.flat().filter(item=>item.filter.time.period==='month').length).toBeGreaterThan(0);
  await main().getByRole('columnheader',{name:'月度得分',exact:true}).click();
  await changeMode('年','年度得分');
  await expect(main().getByRole('columnheader',{name:'月度得分分组',exact:true})).toHaveCount(0);
  await changeMode('季','季度得分');
  const downloadPending=page.waitForEvent('download');
  await main().getByRole('button',{name:'导出',exact:true}).click();
  const download=await downloadPending,file=path.join(output,'quarter-columns.xlsx');
  await download.saveAs(file);
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(file);
  const cells=JSON.stringify(book.worksheets[0].getSheetValues());
  expect(cells).toContain('季度得分');expect(cells).not.toContain('年度得分');expect(cells).not.toContain('月度得分');
  await page.screenshot({path:path.join(output,'quarter-1440.png'),fullPage:true});
  await changeMode('近一年','近一年得分');
  const url=page.url();await page.goto(url);
  await expect(main().getByRole('columnheader',{name:'近一年得分',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:900});
  await changeMode('月','月度得分');
  await page.screenshot({path:path.join(output,'month-390.png'),fullPage:true});
}
async function select(label,option){
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.getByRole('option',{name:option,exact:true}).click();
}
async function editorMigration(){
  await page.setViewportSize({width:1440,height:1050});
  await page.goto(`${editorBase}/tests/browser/report-date-editor.html?dashboard`);
  await select('编辑已有筛选','统计年份');
  await expect(page.getByRole('button',{name:'sales 查询期间策略',exact:true})).toHaveText('保留旧协议');
  await page.getByRole('textbox',{name:'标签',exact:true}).fill('统计期间改名');
  await page.getByRole('button',{name:'应用日期配置',exact:true}).click();
  let document=JSON.parse(await page.getByTestId('page-document').textContent());
  expect(document.filters[0].periodModes).toEqual(['year']);
  expect(document.dataSources.sales.source.query.body.dsl_list[0].filter.time.period).toBe('day');
  expect(document.dataSources.sales.source.query.filterBindings['period-filter'].periodPolicy).toBeUndefined();
  await select('sales 查询期间策略','固定按年（必要时扩大范围）');
  await page.getByRole('button',{name:'应用日期配置',exact:true}).click();
  document=JSON.parse(await page.getByTestId('page-document').textContent());
  expect(document.dataSources.sales.source.query.filterBindings['period-filter'].periodPolicy).toEqual({kind:'fixed',period:'year'});
  expect(document.dataSources.sales.source.query.body.dsl_list[0].filter.time).toEqual({is_aggregate:false});
  expect(document.dataSources.fixed.source.query.body.dsl_list[0].filter.time.period).toBe('day');
  await page.screenshot({path:path.join(output,'explicit-migration.png'),fullPage:true});
}
try{
  await projectedColumns();await editorMigration();expect(errors).toEqual([]);
  await writeFile(path.join(output,'result.json'),JSON.stringify({page:fixture.id,errors,requests,passed:['year/quarter/month/last12 columns','empty group removal','XLSX current columns','URL recovery','390px','legacy label edit','explicit migration','unselected source preserved']},null,2));
  console.log('Period policy browser acceptance passed');
}finally{await browser.close();}
