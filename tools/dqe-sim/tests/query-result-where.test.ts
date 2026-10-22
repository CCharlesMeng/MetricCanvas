import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, type PageDocument } from '../../../packages/page/src';
import { createDqeGateway } from '../../../packages/engine/data-gateway/src/dqe';
import { orchestrate, type PageDataSnapshots } from '../../../packages/engine/runtime/src/orchestrator';
import { prepareExportSnapshots } from '../../../packages/engine/runtime/src/export-snapshots';
import { createDqeSimServer, DQE_EXECUTE_PATH } from '../src/server';
import { executeQueryResultWhere } from '../src/query-result-where';
import fixture from '../fixtures/query-result-where-paged.json';
const document = (): PageDocument => JSON.parse(readFileSync(new URL('../../../pages/capabilities/query/query-result-where-page.json', import.meta.url), 'utf8'));
const ids = (rows: Array<Record<string, unknown>>, field='项目编号') => rows.map(row => row[field]);
const sorted = (field: string, direction: 'asc'|'desc') => [...fixture.projects].sort((a,b) => {
  const x=Reflect.get(a,field),y=Reflect.get(b,field);
  return (direction==='asc'?1:-1)*(typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'zh-CN')) || a['项目编号'].localeCompare(b['项目编号']);
});

describe('query-result-where paged development page',()=>{
  it('queries only the window, accepts every sortable column, resets pagination and exports the captured window',async()=>{
    const parsed=parsePage(document());if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const exchanges:Array<{request:{dsl_list:Array<{output_metrics:string[];order:Record<string,unknown>;filter:{dims:Array<{dim_name:string;dim_value_list:string[]}>}}>}}>=[];
    const server=createDqeSimServer({logger:line=>exchanges.push(JSON.parse(line.slice(line.indexOf('\n')+1)))});
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();if(!address||typeof address==='string')throw Error('server');
    const gateway=createDqeGateway({endpoint:`http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`});
    const stream=orchestrate(parsed.page,gateway);let snapshots:PageDataSnapshots=new Map();const stop=stream.subscribe(next=>snapshots=next);
    async function assertWindow(expected: typeof fixture.projects) {
      await expect.poll(()=>{const s=snapshots.get('projects');return s?.status==='ready'?ids(s.rows,'project-id'):[];}).toEqual(ids(expected));
      expect(snapshots.get('projects')).toMatchObject({status:'ready',totalCount:80});
      for(const [id,high] of [['details-high',true],['details-low',false]] as const) {
        const selected=expected.filter(row=>row['状态']==='进行中'&&(high?row['金额']>3e6:row['金额']<=3e6));
        const expectedIds=selected.map(row=>row['项目编号']).sort();
        await expect.poll(()=>{const s=snapshots.get(id);return s?.status==='ready'?ids(s.rows,'project-id').sort():s?.status==='empty'?[]:null;}).toEqual(expectedIds);
      }
    }
    try {
      await assertWindow(sorted('金额','desc').slice(0,10));
      expect(exchanges.flatMap(e=>e.request.dsl_list).filter(q=>q.output_metrics.includes('时长'))).toHaveLength(1);
      stream.setQueryPage('projects',2);await assertWindow(sorted('金额','desc').slice(20,30));
      expect(stream.captureQueries().get('projects')?.pagination).toEqual({offset:20,limit:10});
      for(const [field,external] of [['project-id','项目编号'],['project-name','项目名称'],['status','状态'],['amount','金额'],['duration','时长']]) {
        for(const direction of ['asc','desc'] as const) {
          stream.setQuerySort('projects',[{field,direction}]);await assertWindow(sorted(external,direction).slice(0,10));
          expect(stream.captureQueries().get('projects')).toMatchObject({pagination:{offset:0,limit:10},sort:[{queryField:external,direction}]});
        }
      }
      stream.setQuerySort('projects',[{field:'status',direction:'asc'},{field:'amount',direction:'desc'}]);
      const multiple=[...fixture.projects].sort((a,b)=>a['状态'].localeCompare(b['状态'],'zh-CN')||b['金额']-a['金额']);
      await assertWindow(multiple.slice(0,10));
      stream.setQueryPage('projects',1);await assertWindow(multiple.slice(10,20));
      stream.setQueryPageSize('projects',20);await assertWindow(multiple.slice(0,20));
      stream.setQueryPage('projects',1);await assertWindow(multiple.slice(20,40));
      const captured=stream.captureQueries();expect(captured.get('projects')?.pagination).toEqual({offset:20,limit:20});
      const exported=await prepareExportSnapshots(parsed.page,gateway,captured,new Map(),new AbortController().signal);
      expect(exported.get('projects')).toMatchObject({status:'ready',totalCount:80,rows:multiple.slice(20,40).map(row=>({'project-id':row['项目编号']}))});
      const items=exchanges.flatMap(e=>e.request.dsl_list);
      expect(items.filter(q=>q.output_metrics.includes('时长')).every(q=>q.order.limit===10||q.order.limit===20)).toBe(true);
      expect(items.filter(q=>q.output_metrics.includes('得分')).every(q=>!('offset' in q.order)&&!('limit' in q.order)&&q.filter.dims.length===1)).toBe(true);
      expect(items.some(q=>q.order.offset===20&&q.order.limit===10)).toBe(true);
      expect(items.some(q=>Array.isArray(q.order.by)&&q.order.by.length===2)).toBe(true);
    } finally {stop();server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  });
  it('sorts before pagination and reports the population count',()=>{
    const item=document().dataSources.projects.source;
    if(item.type!=='query')throw Error('query');
    const query=item.query.body!.dsl_list[0];query.order={by:[{field:'时长',type:'asc',priority:1}],limit:10,offset:10};
    const result=executeQueryResultWhere(query);
    expect(result?.code).toBe('SUCCESS');expect(result?.data).toEqual(sorted('时长','asc').slice(10,20));expect(result?.total_count).toBe(80);
    query.order={by:[{field:'不存在',type:'asc',priority:1}],limit:10};expect(executeQueryResultWhere(query)?.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  });
  it.each([{ids:[]},{ids:['UNKNOWN']}])('rejects empty and unknown detail identifiers: $ids',({ids})=>{
    expect(executeQueryResultWhere({output_dims:['项目编号','项目名称'],output_metrics:['得分','金额'],filter:{time:{period:'month',start:'202610',end:'202610'},dims:[{dim_name:'项目编号',dim_value_list:ids}],metrics:[]},order:{}})?.code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  });
});
