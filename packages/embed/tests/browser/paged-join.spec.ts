import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ExcelJS=createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const fixture=()=>JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/multi-query-table.json',import.meta.url),'utf8'));
const originalOffices=JSON.parse(readFileSync(new URL('../../../data-execution/tests/fixtures/offices.json',import.meta.url),'utf8')) as Array<Record<string,string|number>>;
const byAmount=[...originalOffices].sort((a,b)=>Number(b['bidding-amount'])-Number(a['bidding-amount']));
const offices=originalOffices.map(row=>({...row,'bidding-rank':byAmount.findIndex(candidate=>candidate['rep-office-code']===row['rep-office-code'])+1}));

test.beforeEach(async({page})=>{
 const document=fixture();
 await page.goto('/examples/inline.html');
 await page.evaluate(({document,offices})=>{
  window.runtime.destroy();
  window.runtime=MetricCanvas.mount('#dashboard',{document,dataGateway:{async fetchData(query){
   const mapped=(name:string)=>Object.entries(query.fieldMappings).find(([,f])=>'queryField' in f&&f.queryField===name)![0];
   let rows=offices.map((r:Record<string,string|number>)=>({...r}));
   for(const filter of query.filterValues){
    if(filter.target==='dimension'&&filter.queryField==='rep_office_code')rows=rows.filter((r:Record<string,string|number>)=>filter.values.includes(r['rep-office-code']));
    if(filter.target==='metricRange'){const field=mapped(filter.metric);rows=rows.filter(r=>{const value=r[field];return typeof value==='number'&&(filter.from===undefined||value>=filter.from)&&(filter.to===undefined||value<=filter.to);});}
   }
   if(query.sort)rows.sort((a:Record<string,string|number>,b:Record<string,string|number>)=>{for(const sort of query.sort!){const field=mapped(sort.queryField),difference=a[field]<b[field]?-1:a[field]>b[field]?1:0;if(difference)return sort.direction==='asc'?difference:-difference;}return 0;});
   const totalCount=rows.length;
   if(query.pagination)rows=rows.slice(query.pagination.offset,query.pagination.offset+query.pagination.limit);
   return {rows:rows.map((r:Record<string,string|number>)=>Object.fromEntries(Object.keys(query.fieldMappings).map(field=>[field,r[field]]))),totalCount};
  }}});
 },{document,offices});
});

test('global sort, cross-source ranges, committed drafts and full frozen export preserve independent rows',async({page},testInfo)=>{
 const main=page.locator('[data-component="overview/office-overview-table"]'),probe=page.locator('[data-component="overview/meeting-probe"]');
 const names=async()=>main.locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.textContent));
 await expect(main.locator('tbody tr')).toHaveCount(3);expect((await names()).join()).toContain('广州');await expect(probe.locator('tbody tr')).toHaveCount(8);
 // First click is ascending, second descending under existing pure Table interaction.
 const rate=main.getByRole('button',{name:/项目分析会召开率/});
 await rate.click();await rate.click();
 await expect(main.getByRole('cell',{name:'深圳代表处',exact:true})).toBeVisible();
 await expect(probe.locator('tbody tr')).toHaveCount(8);
 await main.getByRole('button',{name:'下一页',exact:true}).click();await expect(main.getByRole('cell',{name:'杭州代表处',exact:true})).toBeVisible();expect((await names())[0]).toMatch(/4/);
 const amountHeader=main.locator('th').filter({hasText:'预签金额'});await amountHeader.locator('summary').click();
 await amountHeader.getByRole('textbox',{name:'数值下限'}).fill('150000000');await amountHeader.getByRole('textbox',{name:'数值下限'}).press('Tab');
 await expect(main.getByRole('cell',{name:'广州代表处',exact:true})).toBeVisible();await expect(main.getByRole('cell',{name:'深圳代表处',exact:true})).toHaveCount(0);
 const rateHeader=main.locator('th').filter({hasText:'项目分析会召开率'});await rateHeader.locator('summary').click();
 await rateHeader.getByRole('textbox',{name:'数值下限'}).fill('85');await rateHeader.getByRole('textbox',{name:'数值下限'}).press('Tab');
 await expect(main.locator('tbody tr')).toHaveCount(1);await expect(main.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();await expect(probe.locator('tbody tr')).toHaveCount(8);
 // Loading retains the popover instead of remounting a closed header.
 if(await rateHeader.locator('details').getAttribute('open')===null)await rateHeader.locator('summary').click();
 await rateHeader.getByRole('button',{name:'清除筛选'}).click();await expect(main.locator('tbody tr')).toHaveCount(3);
 await amountHeader.locator('summary').click();await amountHeader.getByRole('textbox',{name:'数值下限'}).fill('-');await amountHeader.getByRole('textbox',{name:'数值下限'}).press('Tab');await expect(main.locator('tbody tr')).toHaveCount(3);
 // Export uses committed 150M despite the invalid draft.
 const download=page.waitForEvent('download');await main.getByRole('button',{name:'导出',exact:true}).click();
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile((await(await download).path())!);expect(workbook.worksheets[0].rowCount).toBe(4);
 await amountHeader.locator('summary').click();await amountHeader.getByRole('button',{name:'清除筛选'}).click();
 await main.getByRole('searchbox').fill('天津');await main.getByRole('searchbox').press('Enter');await expect(main.getByRole('cell',{name:'天津代表处',exact:true})).toBeVisible();await expect(main.locator('tbody tr')).toHaveCount(1);await expect(probe.locator('tbody tr')).toHaveCount(8);
 await main.getByRole('button',{name:'清空表格搜索'}).click();await expect(main.locator('tbody tr')).toHaveCount(3);
 const all=page.waitForEvent('download');await main.getByRole('button',{name:'导出',exact:true}).click();const full=new ExcelJS.Workbook();await full.xlsx.readFile((await(await all).path())!);expect(full.worksheets[0].rowCount).toBe(9);
 await page.screenshot({path:testInfo.outputPath('paged-join-global-sort.png'),fullPage:true});
});

test('business amount rank follows each office while both table views remain independent',async({page},testInfo)=>{
 const ordinal=page.locator('[data-component="overview/office-overview-table"]');
 const fixed=page.locator('[data-component="overview/office-fixed-rank-table"]');
 const ranks=()=>fixed.locator('tbody tr td:first-child').allTextContents();
 await expect(fixed.locator('tbody tr')).toHaveCount(3);
 expect((await ranks()).map(value=>value.trim())).toEqual(['1','2','3']);
 const rate=fixed.getByRole('button',{name:/项目分析会召开率/});await rate.click();await rate.click();
 await expect(fixed.getByRole('cell',{name:'深圳代表处',exact:true})).toBeVisible();
 expect((await ranks()).map(value=>value.trim())).toEqual(['1','4','2']);
 await expect(ordinal.getByRole('cell',{name:'广州代表处',exact:true})).toBeVisible();
 await expect(ordinal.getByRole('cell',{name:'深圳代表处',exact:true})).toHaveCount(0);
 await fixed.getByRole('button',{name:'下一页',exact:true}).click();
 await expect(fixed.getByRole('cell',{name:'杭州代表处',exact:true})).toBeVisible();
 expect((await ranks()).map(value=>value.trim())).toEqual(['5','6','3']);
 const header=fixed.locator('th').filter({hasText:'项目分析会召开率'});await header.locator('summary').click();
 await header.getByRole('textbox',{name:'数值下限'}).fill('85');await header.getByRole('textbox',{name:'数值下限'}).press('Tab');
 await expect(fixed.locator('tbody tr')).toHaveCount(2);
 expect((await ranks()).map(value=>value.trim())).toEqual(['1','4']);
 const download=page.waitForEvent('download');await fixed.getByRole('button',{name:'导出',exact:true}).click();
 const book=new ExcelJS.Workbook();await book.xlsx.readFile((await(await download).path())!);
 expect(book.worksheets[0].getRow(1).getCell(1).value).toBe('预签金额排名');
 expect([book.worksheets[0].getRow(2).getCell(1).value,book.worksheets[0].getRow(3).getCell(1).value]).toEqual([1,4]);
 await header.locator('summary').click();await header.getByRole('button',{name:'清除筛选'}).click();
 await fixed.getByRole('searchbox').fill('天津');await fixed.getByRole('searchbox').press('Enter');
 await expect(fixed.locator('tbody tr')).toHaveCount(1);expect((await ranks()).map(value=>value.trim())).toEqual(['8']);
 await page.screenshot({path:testInfo.outputPath('paged-join-fixed-rank.png'),fullPage:true});
});
