import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const base=process.env.PERIOD_QUERY_BASE_URL??'http://127.0.0.1:5218';
const port=Number(process.env.PERIOD_QUERY_BACKEND_PORT??18348);
const output=process.argv[2]??'/tmp/metriccanvas-period-defaults';
const fixture=JSON.parse(await readFile(new URL('../../../pages/capabilities/filters/period-query-defaults-legacy.json',import.meta.url),'utf8'));
let rejectQuarter=false;
const server=createServer(async(request,response)=>{
  const chunks=[];
  for await(const chunk of request)chunks.push(chunk);
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const results=body.dsl_list.map(item=>rejectQuarter&&item.filter.time?.period==='quarter'
    ?{code:'DQE_QUERY_REJECTED',retDesc:'Synthetic unsupported quarter',data:[],total_count:0}
    :{code:'SUCCESS',data:[{'区域':'合成地区','Tokens消耗量':30}],total_count:1});
  response.writeHead(200,{'content-type':'application/json'});
  response.end(JSON.stringify({retCode:'CBC.0000',results}));
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const requests=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{
  if(request.method()==='POST'&&request.url().endsWith('/dsl/execute'))requests.push(request.postDataJSON());
});
const items=()=>requests.flatMap(body=>body.dsl_list);
try{
  await page.clock.install({time:new Date('2026-10-15T04:00:00Z')});
  await page.goto(`${base}/pages/${fixture.id}`);
  await expect(page.getByText('合成地区',{exact:true})).toHaveCount(3);
  expect(items()).toEqual(expect.arrayContaining([
    expect.objectContaining({filter:expect.objectContaining({time:{is_aggregate:true,period:'quarter',start:'2026-Q3',end:'2026-Q3'}})}),
    expect.objectContaining({filter:expect.objectContaining({time:{is_aggregate:true,period:'month',start:'2026-07',end:'2026-09'}})}),
    expect.objectContaining({filter:expect.objectContaining({dims:[{dim_name:'账期',operator:'>=',dim_value_list:['20260701']},{dim_name:'账期',operator:'<=',dim_value_list:['20260930']}]})})
  ]));
  await page.screenshot({path:path.join(output,'quarter.png'),fullPage:true});
  for(const [label,period,start,end] of [['月','month','2026-07','2026-07'],['年','year','2026','2026'],['近一年','month','2025-10','2026-09']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect.poll(()=>items().some(item=>item.filter.time?.period===period&&item.filter.time.start===start&&item.filter.time.end===end)).toBe(true);
    await expect(page.getByText('合成地区',{exact:true})).toHaveCount(3);
  }
  rejectQuarter=true;requests.length=0;
  await page.goto(`${base}/pages/${fixture.id}`);
  await expect(page.getByText('合成地区',{exact:true})).toHaveCount(2);
  expect(items().filter(item=>item.filter.time?.period==='quarter')).toHaveLength(1);
  expect(items().filter(item=>item.filter.time?.period==='month')).toHaveLength(1);
  expect(items()).toHaveLength(3);
  expect(errors).toEqual([]);
  await writeFile(path.join(output,'result.json'),JSON.stringify({fixture:fixture.id,transport:'native HTTP through Playground proxy',rejectedQuarterNoFallback:requests,errors},null,2));
  console.log('Period defaults browser acceptance passed: native HTTP, fixed month, custom fields and unsupported quarter');
}finally{
  await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
