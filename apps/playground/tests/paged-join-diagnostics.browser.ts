import {expect,test} from '@playwright/test';
import {createRequire} from 'node:module';
const requireTs=createRequire(import.meta.url);
requireTs('tsx/cjs');
const {executeDqeItem}=requireTs('../../../tools/dqe-sim/src/execute.ts') as typeof import('../../../tools/dqe-sim/src/execute');

for(const mode of ['ready','null','duplicate','truncated','budget'] as const){
  test(`pagedJoin ${mode}: shows usable data warnings or retains a resource failure`,async({page},info)=>{
    const requests:string[][]=[],logs:Array<Promise<unknown[]>>=[];
    page.on('console',message=>{
      if(message.type()==='error'||message.type()==='warning')logs.push(Promise.all(message.args().map(arg=>arg.jsonValue())));
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
    }else if(mode!=='budget'){
      await expect(table.locator('tbody tr')).toHaveCount(3);
      await expect(table.locator('.total')).toContainText(mode==='truncated'?'8':'7');
      await expect(table.getByText('部分数据异常，当前展示可用结果',{exact:true})).toBeVisible();
      await expect.poll(async()=>JSON.stringify(await Promise.all(logs))).toContain('TABLE_RESULT_RECOVERED');
      const text=JSON.stringify(await Promise.all(logs));
      expect(text).toContain('office-directory');expect(text).not.toContain('上海');expect(text).not.toContain('SH-01');
    }else{
      await expect(table.getByRole('cell',{name:'暂无数据',exact:true})).toBeVisible();
      const code='DQE_QUERY_REJECTED';
      await expect.poll(async()=>JSON.stringify(await Promise.all(logs))).toContain(code);
      const output=await Promise.all(logs),text=JSON.stringify(output);
      for(const locator of ['office-overview','directory','office-directory','rep-office-code','rep_office_code','/dataSources/office-overview/source/members/directory/key'])expect(text).toContain(locator);
      expect(text).toContain('maxRows=1000');
      expect(text).not.toContain('上海');expect(text).not.toContain('SH-01');
      expect(requests.flat()).toHaveLength(1);
      await expect(table.getByText(code)).toHaveCount(0);
    }
    await page.screenshot({path:info.outputPath(`${mode}.png`),fullPage:true});
  });
}
