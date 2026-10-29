import {describe, expect, it} from 'vitest';
import {applyComputation} from '../src/compute';
import {computedSnapshots} from '../src/compute/snapshots';
import {normalizeQueryRows, type DataRow, type DataSource, type DataSnapshot, type UnionKeysOperator} from '@metriccanvas/page/internal';

const op: UnionKeysOperator={op:'unionKeys',sources:['a','b'],keys:['org']};

describe('组织键并集求值', () => {
  it('按首次出现顺序合并，同键不同类型不混同，输入不变', () => {
    const dependencies=new Map<string,DataRow[]>([['a',[{org:0,value:1},{org:'0'},{org:false}]],['b',[{org:'乙'},{org:0}]]]);
    const before=structuredClone(dependencies);
    expect(applyComputation([op],[],dependencies)).toEqual([{org:0},{org:'0'},{org:false},{org:'乙'}]);
    expect(dependencies).toEqual(before);
    expect(applyComputation([op],[],new Map([['a',[]],['b',[]]]))).toEqual([]);
  });
  it('组合键不会因分隔符碰撞，单来源重复键不静默折叠', () => {
    const composite={...op,keys:['org','team']};
    const a=[{org:'x|y',team:'z'},{org:'x',team:'y|z'}];
    expect(applyComputation([composite],[],new Map([['a',a],['b',[]]]))).toEqual(a);
    expect(()=>applyComputation([op],[],new Map([['a',[{org:'甲'},{org:'甲'}]],['b',[]]]))).toThrow('重复组合键');
  });
  it.each([undefined,null,'','   ',NaN,Infinity,[]])('拒绝非法组织键 %s', value => {
    expect(()=>applyComputation([op],[],new Map([['a',[{org:value} as DataRow]],['b',[]]]))).toThrow('并集键缺失');
  });
  it('缺依赖不视作空集，归一化失配的维度不能变成组织键', () => {
    expect(()=>applyComputation([op],[],new Map([['a',[]]]))).toThrow('并集依赖尚未完成');
    const normalized=normalizeQueryRows([{org:12}],{org:{type:'string',role:'dimension',queryField:'org'}});
    if (!normalized.ok) throw Error('归一化失败');
    expect(()=>applyComputation([op],[],new Map([['a',normalized.rows],['b',[]]]))).toThrow('并集键缺失');
  });
});

describe('完整快照边界', () => {
  const fields={org:{type:'string',role:'dimension'}} as const;
  const query: DataSource={fields:{org:{...fields.org,queryField:'组织'}},source:{type:'query',resultScope:'complete',query:{language:'dqe',body:{dsl_list:[{output_dims:['组织'],output_metrics:[]}]}}}};
  const sources=new Map<string,DataSource>([['a',query],['b',{fields,source:{type:'inline',rows:[]}}],['combined',{fields,source:{type:'inline',rows:[]},compute:[op]}]]);
  const calculate=(snapshot:DataSnapshot)=>computedSnapshots(sources,new Map<string,DataSnapshot>([['a',snapshot],['b',{status:'empty'}],['combined',{status:'empty',totalCount:0}]]));
  it('行集合变化后更新 totalCount', () => {
    expect(calculate({status:'ready',rows:[{org:'甲'},{org:'乙'}],totalCount:2}).get('combined')).toMatchObject({status:'ready',rows:[{org:'甲'},{org:'乙'}],totalCount:2});
  });
  it.each([
    {status:'loading'},
    {status:'error',error:{code:'DQE_EXECUTION_ERROR',message:'失败'}},
    {status:'ready',rows:[{org:'甲'}],totalCount:10}
  ] as DataSnapshot[])('等待或传播异常，不生成部分总分 %s', snapshot => {
    expect(calculate(snapshot).get('combined')?.status).toBe(snapshot.status==='loading'?'loading':'error');
  });
});
