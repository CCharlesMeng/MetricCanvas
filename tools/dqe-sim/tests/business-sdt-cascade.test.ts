import { readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { parsePage } from '../../../packages/page/src/validate';
import { createDqeGateway } from '../../../packages/engine/data-gateway/src/dqe';
import { orchestrate, type PageDataSnapshots } from '../../../packages/engine/runtime/src/orchestrator';
import { prepareExportSnapshots } from '../../../packages/engine/runtime/src/export-snapshots';
import { createDqeSimServer, DQE_EXECUTE_PATH } from '../src/server';
import { executeBusinessSdt } from '../src/business-sdt';
import fixture from '../fixtures/business-sdt-cascade.json';
import october from '../fixtures/business-sdt-cascade-october.json';

it.each([fixture, october])('HTTP accepts ISO and compact $month identically for Top5 and stages', async dataset => {
  const document=JSON.parse(readFileSync(new URL('../../../pages/business-sdt-cascade-example.json',import.meta.url),'utf8'));
  const server=createDqeSimServer({logger:()=>{}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const endpoint=`http://127.0.0.1:${(server.address() as AddressInfo).port}${DQE_EXECUTE_PATH}`;
  try {
    for(const suffix of ['', '-stages']) {
      const item=structuredClone(document.dataSources[`project-efficiency-bottom5${suffix}`].source.query.body.dsl_list[0]);
      if(suffix)item.filter.dims=[{dim_name:'商务编号',dim_value_list:dataset.projects.slice(0,5).map(row=>row['商务编号'])}];
      const results=[];
      for(const month of [dataset.month,`${dataset.month.slice(0,4)}-${dataset.month.slice(4)}`]) {
        item.filter.time={period:'month',start:month,end:month};
        const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({dsl_list:[item]})});
        const result=(await response.json()).results[0];
        expect(result.code).toBe('SUCCESS');expect(result.data.length).toBeGreaterThan(0);results.push(result);
      }
      expect(results[0]).toEqual(results[1]);
      for(const month of ['2026--09','2026-9','2026-13','0000-09',202609,null]) {
        item.filter.time={period:'month',start:month,end:month};
        expect(executeBusinessSdt(item)?.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
      }
    }
  } finally {
    server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

it.each([fixture,october])('real local HTTP: $month uses its own identifiers in both Top5 tables and export', async dataset => {
  const document=JSON.parse(readFileSync(new URL('../../../pages/business-sdt-cascade-example.json',import.meta.url),'utf8'));
  for (const rank of ['bottom5','top5']) for (const suffix of ['','-stages']) {
    const time=document.dataSources[`project-efficiency-${rank}${suffix}`].source.query.body.dsl_list[0].filter.time;
    time.start=dataset.month;time.end=dataset.month;
  }
  const parsed=parsePage(document);
  if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));
  const exchanges:Array<{request:{dsl_list:Array<Record<string,unknown>>};response:unknown}>=[];
  const server=createDqeSimServer({logger:message=>exchanges.push(JSON.parse(message.slice(message.indexOf('\n')+1)))});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const gateway=createDqeGateway({endpoint:`http://127.0.0.1:${(server.address() as AddressInfo).port}${DQE_EXECUTE_PATH}`});
  const stream=orchestrate(parsed.page,gateway);
  let snapshots:PageDataSnapshots=new Map();
  const stop=stream.subscribe(value=>snapshots=value);
  try {
    await expect.poll(()=>snapshots.get('project-efficiency-bottom5')?.status).toBe('ready');
    await expect.poll(()=>snapshots.get('project-efficiency-top5')?.status).toBe('ready');
    expect(exchanges).toHaveLength(2);
    const first=exchanges[0].request.dsl_list;
    expect(first).toHaveLength(2);
    expect(first.every(item=>(item.output_dims as string[]).includes('客户名称'))).toBe(true);
    const second=exchanges[1].request.dsl_list;
    expect(second).toHaveLength(2);
    expect(second.every(item=>(item.output_dims as string[]).includes('阶段名称'))).toBe(true);
    for (const rank of ['bottom5','top5']) {
      const id=`project-efficiency-${rank}`,snapshot=snapshots.get(id)!;
      if(snapshot.status!=='ready')throw new Error('ready');
      expect(snapshot.rows).toHaveLength(5);
      const ids=snapshot.rows.map(row=>row['commerce-id']);
      const request=second.find(item=>{
        const filter=item.filter as {dims:Array<{dim_value_list:string[]}>};
        return ids.every(value=>filter.dims[0].dim_value_list.includes(String(value)));
      });
      expect(request).toBeDefined();
      expect((request!.filter as {dims:Array<{dim_value_list:string[]}>}).dims[0].dim_value_list).toHaveLength(5);
      for (const row of snapshot.rows) for (const [category,prefix] of [['代表处SDT','rep-office'],['地区部SDT','region'],['华为云计算SDT','cloud']]) {
        const stage=dataset.stages.find(value=>value['商务编号']===row['commerce-id']&&value['阶段名称']===category);
        expect(row[`${prefix}-time`]).toBe(stage?.['SDT成员决策时长']??null);
        expect(row[`${prefix}-count`]).toBe(stage?.['SDT成员决策次数']??null);
      }
    }
    const exportPage={...parsed.page,sections:parsed.page.sections.filter(section=>section.id==='project-efficiency-section')};
    const exported=await prepareExportSnapshots(exportPage,gateway,stream.captureQueries(),new Map(),new AbortController().signal);
    expect(exported.get('project-efficiency-bottom5')).toEqual(snapshots.get('project-efficiency-bottom5'));
    expect(exported.get('project-efficiency-top5')).toEqual(snapshots.get('project-efficiency-top5'));
    if(process.env.SDT_EVIDENCE_PATH)writeFileSync(dataset.month==='202609'?process.env.SDT_EVIDENCE_PATH:process.env.SDT_EVIDENCE_PATH.replace('.json','-october.json'),JSON.stringify({kind:'local-http-simulation',month:dataset.month,exchanges,snapshots:Object.fromEntries(snapshots),exported:Object.fromEntries(exported)},null,2));
  } finally {
    stop();server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

it('simulator rejects empty or unknown detail sets rather than executing an unfiltered query',()=>{
  for(const ids of [[],['UNKNOWN']])expect(executeBusinessSdt({output_dims:['商务编号','阶段名称'],output_metrics:['SDT成员决策时长','SDT成员决策次数'],filter:{time:{period:'month',start:'202609',end:'202609'},dims:[{dim_name:'商务编号',dim_value_list:ids}],metrics:[]},order:{}})?.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
});
