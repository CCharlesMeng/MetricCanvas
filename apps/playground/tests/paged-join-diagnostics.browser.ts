import {expect,test} from '@playwright/test';
import {createRequire} from 'node:module';
const requireTs=createRequire(import.meta.url);
requireTs('tsx/cjs');
const {executeDqeItem}=requireTs('../../../tools/dqe-sim/src/execute.ts') as typeof import('../../../tools/dqe-sim/src/execute');

for(const mode of ['ready','null','duplicate','truncated','budget'] as const){
  test(`pagedJoin ${mode}: console locates the member and the component retains its empty state`,async({page},info)=>{
    const requests:string[][]=[],logs:Array<Promise<unknown[]>>=[];
    page.on('console',message=>{
      if(message.type()==='error')logs.push(Promise.all(message.args().map(arg=>arg.jsonValue())));
    });
    await page.addInitScript(()=>Object.assign(window,{__METRICCANVAS__:{
      dqeEndpoint:'/synthetic-join-dqe',pageMetadataBaseUrl:'/pages',authToken:'synthetic',operatorId:'synthetic',workspaceId:'synthetic'
    }}));
    await page.route('**/synthetic-join-dqe',async route=>{
      const body=route.request().postDataJSON();
      requests.push(body.dsl_list.map((item:{output_metrics:string[]})=>item.output_metrics.join(',')));
      const results=body.dsl_list.map(executeDqeItem);
      const domain=body.dsl_list.findIndex((item:{output_metrics:string[]})=>item.output_metrics.length===0);
      if(domain>=0){
        const result=results[domain];
        if(mode==='null')result.data[0].rep_office_code=null;
        if(mode==='duplicate')result.data[1].rep_office_code=result.data[0].rep_office_code;
        if(mode==='truncated')result.total_count=9;
        if(mode==='budget')result.total_count=1001;
      }
      await route.fulfill({json:{retCode:'CBC.0000',results}});
    });
    await page.goto('/pages/paged-join-diagnostics');
    const table=page.locator('[data-component="overview/office-overview-table"]');
    await expect(table.getByRole('table')).toBeVisible();
    if(mode==='ready'){
      await expect(table.locator('tbody tr')).toHaveCount(3);
      await expect(table.getByRole('cell',{name:'上海代表处',exact:true})).toBeVisible();
      expect(requests.flat()).toHaveLength(6);
    }else{
      await expect(table.getByRole('cell',{name:'暂无数据',exact:true})).toBeVisible();
      const code=mode==='budget'?'DQE_QUERY_REJECTED':'DQE_ROW_CONTRACT_ERROR';
      await expect.poll(async()=>JSON.stringify(await Promise.all(logs))).toContain(code);
      const output=await Promise.all(logs),text=JSON.stringify(output);
      for(const locator of ['office-overview','directory','office-directory','rep-office-code','rep_office_code','/dataSources/office-overview/source/members/directory/key'])expect(text).toContain(locator);
      if(mode==='null'){
        expect(text).toContain('第 1 行');expect(text).toContain('实际 null');
        const message=output.find(args=>String(args[0]).includes(code))![0] as string;
        expect(message.split('\n')[0]).toContain('无法合并表格数据：第 1 行的“代表处编码”为空，无法关联其他数据。请检查查询是否返回了有效的“代表处编码”。');
        expect(message.split('\n')[0]).not.toContain('office-directory');
      }
      if(mode==='duplicate'){expect(text).toContain('第 2 行');expect(text).toContain('第 1 行');}
      if(mode==='truncated'){expect(text).toContain('返回 8 行');expect(text).toContain('totalCount=9');}
      if(mode==='budget')expect(text).toContain('maxRows=1000');
      expect(text).not.toContain('上海');expect(text).not.toContain('SH-01');
      expect(requests.flat()).toHaveLength(1);
      await expect(table.getByText(code)).toHaveCount(0);
    }
    await page.screenshot({path:info.outputPath(`${mode}.png`),fullPage:true});
  });
}
