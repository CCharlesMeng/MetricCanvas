import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {parsePage} from '../packages/page/src/index';
import type {DataSnapshot} from '../packages/page/src/snapshot';
import type {QueryDataSource} from '../packages/page/src/data-source';
import {createSourceProgram} from '../packages/data-execution/src/source-program/session';
import {checkOrdinaryRange} from '../packages/data-execution/src/source-program/range-policy';
import {resolveQueryResultInputs} from '../packages/data-execution/src/query-result-inputs';
import {computedSnapshots} from '../packages/data-execution/src/compute/snapshots';
import {hostRenderSnapshot} from '../packages/engine/runtime-ui/src/widget-host-state';
import {createDqeGateway} from '../packages/engine/data-gateway/src/dqe';
import {createZeroTotalPreview} from '../apps/playground/fixtures/zero-total-gateway';

const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/query/query-zero-total-demo.json','utf8')));
if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
const page=parsed.page;
const ready:DataSnapshot={status:'ready',rows:[{region:'甲地区部',score:0},{region:'乙地区部',score:-2}],totalCount:0};
afterEach(()=>vi.restoreAllMocks());

async function read(purpose:'screen'|'complete'='screen', roots=['zero'], gateway=createZeroTotalPreview().dataGateway) {
  const program=createSourceProgram(page,{gateway});
  const updates=[];
  try { for await(const update of program.read({roots,conditions:new Map(),purpose,useInitial:false}))updates.push(update); }
  finally { program.dispose(); }
  return updates;
}

describe('零总数但有返回行：显示并告警',()=>{
  it('保留零值、负值和原始总数，不丢行、不造initial，并输出组件位置',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const updates=await read();
    expect(updates.at(-1)?.snapshot).toEqual(ready);
    expect(updates.at(-1)?.initial).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('TOTAL_COUNT_MISMATCH');
    expect(warn.mock.calls[0]?.[1]).toMatchObject({pageId:'query-zero-total-demo',dataSourceIds:['zero'],rowCount:2,totalCount:0,
      completeness:'unverified',dataSourcePath:'/dataSources/zero',components:expect.arrayContaining([{componentId:'zero-table',componentType:'table',componentTitle:'主查询：总数0，实际2行',componentPath:'/sections/0/components/0',sectionId:'counts',sectionTitle:'合成数据：总数异常不阻断显示',bindingPath:'/sections/0/components/0/data/main',boundSourceId:'zero',relation:'direct'}])});
    expect(warn.mock.calls[0]?.[1]).not.toHaveProperty('rows');
  });

  it('辅助槽总数为零不把已成功的整表投影为空',async()=>{
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    const updates=await read('screen',['normal','zero']);
    const slots=new Map(updates.map(update=>[update.sourceId==='normal'?'main':'aux',update.snapshot]));
    expect(hostRenderSnapshot(page.sections[0]!.components[1]!,slots).status).toBe('ready');
    expect(slots.get('aux')).toEqual(ready);
  });

  it('总数与返回行均为零是正常空结果，不告警',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    expect((await read('screen',['empty'])).at(-1)?.snapshot).toEqual({status:'empty',totalCount:0});
    expect(warn).not.toHaveBeenCalled();
  });

  it('完整导出仍拒绝矛盾总数',async()=>{
    await expect(read('complete')).rejects.toMatchObject({code:'EXPORT_INCOMPLETE_DATA'});
  });

  it('字段映射错误仍失败，不使用总数容错掩盖',async()=>{
    const gateway=createDqeGateway({fetchImpl:async()=>Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',data:[{'地区部':'甲地区部'}],total_count:0}]})});
    expect((await read('screen',['zero'],gateway)).at(-1)?.snapshot).toMatchObject({status:'error',error:{code:'DQE_FIELD_MAPPING_ERROR'}});
  });

  it('非零矛盾总数与非法总数保持失败',()=>{
    const source=page.dataSources.zero!;
    expect(checkOrdinaryRange(source,{...ready,totalCount:1},undefined,undefined,{allowZeroTotal:true}).status).toBe('error');
    expect(checkOrdinaryRange(source,{...ready,totalCount:-1},undefined,undefined,{allowZeroTotal:true}).status).toBe('error');
  });

  it('完整结果绑定不能消费仅供显示的零总数行',()=>{
    const downstream=structuredClone(page.dataSources.normal!) as QueryDataSource;
    downstream.source.query.resultBindings=[{source:'zero',field:'region',target:'dimension',queryField:'地区部',maxValues:10}];
    expect(resolveQueryResultInputs(downstream,new Map([['zero',ready]]),new Map(Object.entries(page.dataSources))).status).toBe('terminal');
  });

  it('跨源计算拒绝将显示回执作为完整依赖',()=>{
    const downstream=structuredClone(page.dataSources.normal!);
    downstream.fields.total={type:'number',role:'measure'};
    downstream.compute=[{op:'joinAggregate',source:'zero',keys:[{local:'region',foreign:'region'}],values:[{aggregate:'sum',field:'score',output:'total'}],onMissing:'null'}];
    const results=computedSnapshots(new Map([['zero',page.dataSources.zero!],['derived',downstream]]),new Map([['zero',ready],['derived',{...ready,totalCount:2}]]));
    expect(results.get('zero')?.status).toBe('ready');
    expect(results.get('derived')?.status).toBe('error');
  });
});
