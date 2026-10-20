import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ExcelJS=createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const endpoint='/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
test.use({timezoneId:'Asia/Shanghai'});
test.beforeEach(async({page})=>{page.on('pageerror',error=>{throw error;});await page.clock.install({time:new Date('2026-10-19T12:00:00+08:00')});});
const table=(page:any)=>page.locator('[data-component="body/bound-table"]');
test('day/month/ISO week switch, URL priority, memory and workbook all use the selected static case',async({page})=>{
 const requests:any[]=[];page.on('request',r=>{if(r.url().includes(endpoint)&&r.method()==='POST')requests.push(...r.postDataJSON().dsl_list);});
 await page.goto('/pages/ioc-header-time-modes-demo');await expect(table(page)).toContainText('2026-10-01 至 2026-10-07');
 const period=page.locator('[data-filter-id="period"]');await period.getByRole('combobox',{name:'统计期间开始',exact:true}).fill('2026-10-02');await period.getByRole('combobox',{name:'统计期间开始',exact:true}).press('Enter');await expect(table(page)).toContainText('2026-10-02 至 2026-10-07');await period.getByRole('button',{name:'月',exact:true}).click();await expect(table(page)).toContainText('2026-08 至 2026-09');expect(requests.at(-1).filter.time.period).toBe('month');expect(new URL(page.url()).searchParams.get('period.mode')).toBe('month');
 await period.getByRole('button',{name:'ISO周',exact:true}).click();await expect(period).toContainText('2026-W41');await expect(table(page)).toContainText('2026-10-05 至 2026-10-11');expect(requests.at(-1).filter.time).toMatchObject({period:'week',start:'2026-10-05',end:'2026-10-11'});
 const download=page.waitForEvent('download');await table(page).getByRole('button',{name:'导出',exact:true}).click();const file=await download,workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile((await file.path())!);expect(JSON.stringify(workbook.worksheets[0].getSheetValues())).toContain('2026-10-05 至 2026-10-11');
 await expect(page.getByRole('link',{name:'在新页面恢复当前时间模式'})).toHaveAttribute('href',/period.mode=isoWeek.*period.from=2026-10-05.*period.to=2026-10-11/);
 await period.getByRole('button',{name:'日',exact:true}).click();await expect(table(page)).toContainText('2026-10-02 至 2026-10-07');await period.getByRole('button',{name:'ISO周',exact:true}).click();await page.getByRole('link',{name:'在新页面恢复当前时间模式'}).click();await expect(table(page)).toContainText('2026-10-05 至 2026-10-11');await page.goto('/pages/ioc-header-time-modes-demo?period.mode=month&period.from=2026-01&period.to=2026-03');await expect(table(page)).toContainText('2026-01 至 2026-03');
});
for(const query of ['period.mode=isoWeek&period.from=2026-10-06&period.to=2026-10-12','period.mode=month&period.from=2026-01','period.mode=bad&period.from=2026-01&period.to=2026-03'])test(`rejects malformed mode URL ${query}`,async({page})=>{
 const calls:string[]=[];page.on('request',r=>{if(r.url().includes(endpoint))calls.push(r.url());});await page.goto(`/pages/ioc-header-time-modes-demo?${query}`);await expect(page.getByText('时间模式URL必须为合法完整mode/from/to')).toBeVisible();expect(calls).toHaveLength(0);
});
test('presets use inclusive dates, explicit anchor and reject blocked interior dates without applying drafts',async({page})=>{
 await page.goto('/pages/ioc-header-time-presets-demo');await expect(table(page)).toContainText('2026-10-01 至 2026-10-07');
 await page.getByRole('button',{name:'近7天（含今天）',exact:true}).click();await expect(table(page)).toContainText('2026-10-13 至 2026-10-19');
 await page.getByRole('button',{name:'上个完整月',exact:true}).click();await expect(page.getByText('所选期间包含禁选区间',{exact:true})).toBeVisible();await expect(table(page)).toContainText('2026-10-13 至 2026-10-19');
 await page.getByRole('button',{name:'锚点近3天',exact:true}).click();await expect(table(page)).toContainText('2026-10-05 至 2026-10-07');
});
test('trusted latest/complete are separate, URL wins initial, subscriptions preserve selection and identity stops the old instance',async({page})=>{
 await page.goto('/pages/ioc-header-availability-demo?month=2026-08');await expect(table(page)).toContainText('sales_month=2026-08');await expect(page.locator('[data-ioc-header]')).toContainText('2026年10月19日 10:00:00');
 await page.getByRole('button',{name:'事实等待',exact:true}).click();await expect(page.locator('[data-filter-id="month"] input')).toBeDisabled();await expect(page.locator('[data-component="body/unbound-table"]')).toContainText('无绑定条件');await expect(table(page).getByRole('button',{name:'导出',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'事实恢复',exact:true}).click();await expect(table(page)).toContainText('sales_month=2026-08');
 await page.getByRole('button',{name:'身份变化',exact:true}).click();await expect(page.getByText('权限会话已变化，请以当前身份重新初始化页面')).toBeVisible();await expect(page.locator('[data-ioc-header]')).toHaveCount(0);
 await page.getByRole('button',{name:'重新挂载',exact:true}).click();await expect(table(page)).toContainText('sales_month=2026-08');
});
test('latest initial uses complete period and missing/future choices remain unapplied',async({page})=>{
 await page.goto('/pages/ioc-header-availability-demo');await expect(table(page)).toContainText('sales_month=2026-09');const input=page.getByRole('combobox',{name:'数据月份',exact:true});
 await input.fill('2026-07');await input.press('Enter');await expect(page.getByText('所选期间包含禁选区间',{exact:true})).toBeVisible();await expect(table(page)).toContainText('sales_month=2026-09');
 await input.fill('2026-11');await input.press('Enter');await expect(page.getByText(/日期不得晚于|完整期间超过/)).toBeVisible();await expect(table(page)).toContainText('sales_month=2026-09');
});
test('calendarWindow carries 12 months and a discrete 1/3 month selection; mode change reconciles model only after V2',async({page})=>{
 const candidates:any[]=[],requests:any[]=[];page.on('request',r=>{if(r.url().includes('/__fixtures/filter-candidates'))candidates.push(r.postDataJSON());if(r.url().includes(endpoint)&&r.method()==='POST')requests.push(...r.postDataJSON().dsl_list);});
 await page.goto('/pages/ioc-header-calendar-window-demo');await expect(table(page)).toContainText('month_code=2026-01,2026-03');expect(candidates.find(r=>r.filterId==='months').calendarWindow).toEqual({granularity:'month',from:'2025-11',to:'2026-10'});
 expect(requests.at(-1).filter.dims.find((d:any)=>d.dim_name==='month_code').dim_value_list).toEqual(['2026-01','2026-03']);
 await page.locator('[data-filter-id="period"]').getByRole('button',{name:'日',exact:true}).click();await expect(table(page)).toContainText('model_code=B');expect(candidates.filter(r=>r.filterId==='model').at(-1).constraints.times.period.mode).toBe('day');expect(requests.at(-1).filter.dims.find((d:any)=>d.dim_name==='model_code').dim_value_list).toEqual(['B']);
});
test('readonly and responsive mode popup stay within 1440/1024/390 and close on readonly update',async({page},info)=>{
 await page.goto('/pages/ioc-header-time-modes-demo');await expect(table(page)).toContainText('2026-10-01');
 for(const width of [1440,1024,390]){await page.setViewportSize({width,height:900});const expand=page.getByRole('button',{name:'展开筛选',exact:true});if(await expand.isVisible())await expand.click();await page.getByRole('button',{name:'打开日期选择器',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);const rect=await page.getByRole('dialog').boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width);await page.screenshot({path:info.outputPath(`time-${width}.png`),fullPage:true});await page.getByRole('combobox',{name:'统计期间开始',exact:true}).press('Escape');}
 await page.getByRole('button',{name:'打开日期选择器',exact:true}).click();await page.evaluate(()=>{const w=window as any;w.runtime.update({document:w.pageDocument,dataGateway:w.dataGateway,initialSearch:location.search,filterEditing:{readOnly:true}});});await expect(page.getByRole('dialog')).toHaveCount(0);for(const button of await page.locator('[data-time-modes] button').all())await expect(button).toBeDisabled();await expect(table(page)).toContainText('2026-10-01');
});
test('a legal URL overrides an unavailable dynamic initial period before default validation',async({page})=>{
 await page.goto('/pages/ioc-header-availability-demo');await expect(table(page)).toContainText('sales_month=2026-09');
 await page.evaluate(()=>{const w=window as any;const snapshot={permissions:{},values:{},permissionRevision:'new-source',timeZone:'Asia/Shanghai',periods:{sales:{status:'ready' as const,granularity:'month' as const,latest:'2026-10',latestComplete:'2024-09'}}};w.runtime.destroy();w.runtime=MetricCanvas.mount('#dashboard',{document:w.pageDocument,dataGateway:w.dataGateway,initialSearch:'month=2026-10',displayInputs:{getSnapshot:()=>snapshot,subscribe:()=>()=>{}}});});
 await expect(table(page)).toContainText('sales_month=2026-10');
});
test('calendar window without V2 stays unavailable and never retries the legacy candidate port',async({page})=>{
 await page.goto('/pages/ioc-header-calendar-window-demo');await expect(table(page)).toContainText('month_code=2026-01,2026-03');
 await page.evaluate(()=>{const w=window as any;w.legacyCandidates=0;w.runtime.update({document:w.pageDocument,displayInputs:w.displayInputs,dataGateway:{fetchData:w.dataGateway.fetchData.bind(w.dataGateway),fetchDimensionValues:async()=>{w.legacyCandidates++;return {kind:'values',candidates:[]};}}});});
 const expand=page.getByRole('button',{name:'展开筛选',exact:true});if(await expand.isVisible())await expand.click();await expect(page.locator('[data-filter-id="months"] [data-candidates-status="unavailable"]')).toBeVisible();await expect(page.locator('[data-component="body/unbound-table"]')).toContainText('无绑定条件');await expect(table(page).getByRole('button',{name:'导出',exact:true})).toBeDisabled();expect(await page.evaluate(()=>(window as any).legacyCandidates)).toBe(0);
});
for(const late of ['success','error'])test(`anchor fact unavailable invalidates an in-flight candidate ${late}`,async({page})=>{
 let release!:()=>void,seen!:()=>void;const pending=new Promise<void>(r=>release=r),started=new Promise<void>(r=>seen=r);let first=true,calls=0;
 await page.route('**/__fixtures/filter-candidates',async route=>{if(route.request().postDataJSON().filterId!=='months'){await route.continue();return;}calls++;if(first){first=false;seen();await pending;await route.fulfill({status:late==='success'?200:500,json:late==='success'?{kind:'values',candidates:[{value:'2026-01',label:'旧候选'}]}:{kind:'unavailable'}});}else await route.continue();});
 await page.goto('/pages/ioc-header-calendar-window-demo');await started;const expand=page.getByRole('button',{name:'展开筛选',exact:true});if(await expand.isVisible())await expand.click();await page.getByRole('button',{name:'事实等待',exact:true}).click();const status=page.locator('[data-filter-id="months"] [data-candidates-status="unavailable"]');await expect(status).toBeVisible();
 release();await page.evaluate(()=>new Promise<void>(r=>setTimeout(r,100)));await expect(status).toBeVisible();await expect(page.locator('[data-component="body/bound-table"]').getByRole('button',{name:'导出',exact:true})).toBeDisabled();await page.getByRole('button',{name:'事实恢复',exact:true}).click();await expect(table(page)).toContainText('month_code=2026-01,2026-03');expect(calls).toBeGreaterThan(1);
});


test('one display input source drives both period facts and presentation without extra queries',async({page})=>{
 const requests:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/dsl/execute'))requests.push(request.postData()??'');});
 await page.goto('/pages/ioc-header-availability-demo');
 await expect(table(page)).toContainText('2026-09');
 const note=page.getByText('期间事实与展示条件共用同一可信输入及权限会话。',{exact:true});await expect(note).toBeVisible();
 const count=requests.length;await page.getByRole('button',{name:'隐藏期间说明',exact:true}).click();await expect(note).toHaveCount(0);expect(requests).toHaveLength(count);
 await page.getByRole('button',{name:'显示期间说明',exact:true}).click();await expect(note).toBeVisible();expect(requests).toHaveLength(count);
});


test('failed or withdrawn unified inputs keep temporal queries gated and unrelated data readable',async({page})=>{
 await page.goto('/pages/ioc-header-availability-demo');await expect(table(page)).toContainText('sales_month=2026-09');
 await page.evaluate(()=>{const w=window as any,snapshot=w.displayInputs.getSnapshot();w.runtime.destroy();w.runtime=MetricCanvas.mount('#dashboard',{document:w.pageDocument,dataGateway:w.dataGateway,displayInputs:{getSnapshot:()=>snapshot,subscribe(){throw Error('synthetic subscription failure');}}});});
 await expect(page.locator('[data-component="body/unbound-table"]')).toContainText('无绑定条件');await expect(table(page).getByRole('button',{name:'导出',exact:true})).toBeDisabled();await expect(table(page)).not.toContainText('sales_month=2026-09');
 await page.evaluate(()=>{const w=window as any;w.runtime.destroy();w.runtime=MetricCanvas.mount('#dashboard',{document:w.pageDocument,dataGateway:w.dataGateway,displayInputs:w.displayInputs});});await expect(table(page)).toContainText('sales_month=2026-09');
 await page.evaluate(()=>{const w=window as any;w.runtime.update({document:w.pageDocument,dataGateway:w.dataGateway});});await expect(table(page).getByRole('button',{name:'导出',exact:true})).toBeDisabled();await expect(table(page)).not.toContainText('sales_month=2026-09');await expect(page.locator('[data-component="body/unbound-table"]')).toContainText('无绑定条件');
});
