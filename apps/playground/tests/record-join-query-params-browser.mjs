import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const base=process.env.PLAYGROUND_BASE_URL??'http://127.0.0.1:5187';
const output=process.argv[2]??'/tmp/metriccanvas-record-query-params';
await mkdir(output,{recursive:true});
const cases=[
  {name:'main-a',search:'approver-name=合成审批人甲',total:3,ids:['A-1','A-2'],title:'合成审批人甲 - 商务决策明细'},
  {name:'main-b',search:'approver-name=合成审批人乙',total:1,ids:['A-3'],title:'合成审批人乙 - 商务决策明细'},
  {name:'optional-missing',search:'',total:4,ids:['A-1','A-2']},
  {name:'supplement-only',search:'owner-name=合成责任人甲',total:4,ids:['A-1','A-2']},
  {name:'multiple-inputs',search:'approver-name=合成审批人甲&approver-name=合成审批人乙',total:4,ids:['A-1','A-2'],title:'合成审批人甲、合成审批人乙 - 商务决策明细'},
  {name:'no-match',search:'approver-name=没有匹配记录',total:0,ids:[]}
];
const browser=await chromium.launch({headless:true,channel:'chrome'});
const results=[];
try{
  for(const scenario of cases){
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[],network=[],responses=[],responseTasks=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404 (Not Found)'))errors.push(message.text());});
    page.on('request',request=>{
      if(request.url().includes('/dsl/execute'))network.push({url:request.url(),method:request.method(),body:request.postDataJSON()});
    });
    page.on('response',response=>{
      if(!response.url().includes('/dsl/execute'))return;
      responseTasks.push(response.json().then(body=>responses.push({
        status:response.status(),requestId:response.headers()['x-request-id'],body
      })));
    });
    await page.goto(base+'/pages/record-join-query-params?'+scenario.search);
    const table=page.locator('[data-component$="/approvals"]');
    await expect(table).toBeVisible();
    if(scenario.ids.length){
      for(const id of scenario.ids)await expect(table.getByText(id,{exact:true})).toBeVisible();
      await expect(table).toContainText('总条数： '+scenario.total);
    }else await expect(table.getByText('暂无数据',{exact:true})).toBeVisible();
    if(scenario.title)await expect(table.getByText(scenario.title,{exact:true})).toBeVisible();
    if(scenario.name==='main-a'){
      await page.screenshot({path:path.join(output,'main-a.png'),fullPage:true});
      await table.getByRole('button',{name:'下一页',exact:true}).click();
      await expect(table.getByText('A-4',{exact:true})).toBeVisible();
      await expect(table.getByText('合成责任人甲',{exact:true})).toHaveCount(0);
    }
    await Promise.all(responseTasks);
    expect(errors).toEqual([]);
    expect(network.length).toBeGreaterThan(0);
    expect(responses).toHaveLength(network.length);
    for(const response of responses){
      expect(response.status).toBe(200);
      expect(response.requestId).toMatch(/^dqe-sim-/);
      expect(response.body.results.every(result=>result.code==='SUCCESS')).toBe(true);
    }
    const items=network.flatMap(request=>request.body.dsl_list);
    expect(items.some(item=>JSON.stringify(item.output_dims)===JSON.stringify(['approver-name']))).toBe(false);
    if(scenario.name==='main-a'){
      const main=items.filter(item=>item.query_type==='object'),basic=items.filter(item=>item.query_type!=='object');
      expect(main.length).toBeGreaterThan(0);expect(basic.length).toBeGreaterThan(0);
      expect(main.every(item=>item.filter.fields.some(field=>field.field_name==='审批人姓名'&&field.value_list.includes('合成审批人甲')))).toBe(true);
      expect(JSON.stringify(basic)).not.toContain('审批人姓名');
    }
    results.push({name:scenario.name,total:scenario.total,ids:scenario.ids,errors,dqeHttpCalls:network.length,network,responses});
    await page.close();
  }
  await writeFile(path.join(output,'browser.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({network:_network,responses,...summary})=>({...summary,statuses:responses.map(response=>response.status)})),null,2));
}finally{await browser.close();}
