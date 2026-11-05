import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolvePeriodSelection,type DataSnapshot,type DisplayInputsSnapshot,type EffectiveQuery} from '@metriccanvas/page/internal';
import {createSourceProgram,initialFilterValues} from '../src/runtime';
import {effectiveDqeItem} from '../src/dqe/dqe';

function setup() {
  const parsed=parsePage(JSON.parse(readFileSync('pages/temporary/business-result-config-audit-20261105/business-result-metrics-2.json','utf8')));
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  for(const source of Object.values(parsed.page.dataSources))if(source.source.type==='query')for(const binding of Object.values(source.source.query.filterBindings??{}))if(binding.target==='time'&&binding.periodComparison){binding.periodComparison.fact='net-discount-through';const item=source.source.query.body!.dsl_list[0];(item.filter as {time:{period:string}}).time.period='day';}
  const page=parsed.page, now=new Date('2026-11-05T04:00:00Z');
  const conditions=initialFilterValues(page.filters??[],now);
  conditions.set('mtime',{type:'timeRange',...resolvePeriodSelection({mode:'month',value:'2026-10'},now,'month')});
  const requests:EffectiveQuery[]=[];
  const gateway={async fetchData(query:EffectiveQuery){requests.push(query);return {rows:[],totalCount:0};}};
  let inputs:DisplayInputsSnapshot|undefined;
  const program=createSourceProgram(page,{gateway,now,displayInputs:()=>inputs});
  async function read(options:Partial<Parameters<typeof program.read>[0]>={}) {
    const snapshots=new Map<string,DataSnapshot>();
    for await(const update of program.read({roots:Object.keys(page.dataSources),conditions,useInitial:false,...options}))snapshots.set(update.sourceId,update.snapshot);
    return snapshots;
  }
  function providePeriodFact() {
    inputs={permissions:{},values:{},permissionRevision:'intranet-test',timeZone:'Asia/Shanghai',periods:{'net-discount-through':{status:'ready',granularity:'date',latest:'2026-10-31'}}};
  }
  return {page,program,requests,read,providePeriodFact};
}

it('publishes preparation failures and independent receipts instead of abandoning all loading states',async()=>{
  const test=setup(),log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
    const snapshots=await test.read();
    expect([...snapshots.values()].every(snapshot=>snapshot.status!=='loading')).toBe(true);
    for(const id of ['region-dept-summary-comparison','rep-office-summary-comparison'])expect(snapshots.get(id)).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED',message:expect.stringContaining('统计截止时间不可用')}});
    expect(snapshots.get('region-dept-summary')).toMatchObject({status:'empty'});
    expect(snapshots.get('rep-office-summary')).toMatchObject({status:'empty'});
    expect(test.requests.map(effectiveDqeItem)).not.toContainEqual(expect.objectContaining({filter:expect.objectContaining({time:expect.objectContaining({period:'day'})})}));
    test.providePeriodFact();
    const recovered=await test.read({freshness:'refresh'});
    expect([...recovered.values()].every(snapshot=>snapshot.status!=='loading'&&snapshot.status!=='error')).toBe(true);
    const queries=test.requests.map(effectiveDqeItem);
    expect(queries).toContainEqual(expect.objectContaining({filter:expect.objectContaining({time:{period:'day',is_aggregate:true,start:'2026-10-01',end:'2026-10-31'}})}));
    expect(queries).toContainEqual(expect.objectContaining({filter:expect.objectContaining({time:{period:'day',is_aggregate:true,start:'2025-10-01',end:'2025-10-31'}})}));
  } finally {test.program.dispose();log.mockRestore();}
});

it('preserves strict export failures and rejects cancellation instead of publishing fabricated receipts',async()=>{
  const test=setup(),log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
    await expect(test.read({purpose:'complete'})).rejects.toMatchObject({code:'DQE_QUERY_REJECTED'});
    const partial=await test.read({purpose:'complete',allowPartial:true});
    expect(partial.get('region-dept-summary-comparison')).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});
    const controller=new AbortController();controller.abort();
    await expect(test.read({signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
  } finally {test.program.dispose();log.mockRestore();}
});
