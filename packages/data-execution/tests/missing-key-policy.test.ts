import {describe, expect, it} from 'vitest';
import {normalizeQueryRows, type UnionKeysOperator, type JoinAggregateOperator, type DataRow, type DataSnapshot, type DataSource} from '@metriccanvas/page/internal';
import {applyComputation} from '../src/compute';
import {computedSnapshots} from '../src/compute/snapshots';

const operators: [UnionKeysOperator, JoinAggregateOperator] = [
  {op:'unionKeys', sources:['scores'], keys:['org']},
  {op:'joinAggregate', source:'scores', keys:[{local:'org',foreign:'org'}], values:[{field:'score',output:'score',aggregate:'unique'}], onMissing:'null'}
];
const fields = {org:{type:'string',role:'dimension'},score:{type:'number',role:'measure'}} as const;
const scores: DataSource = {fields,source:{type:'inline',rows:[]}};
const combined: DataSource = {fields,source:{type:'inline',rows:[]},compute:operators};

function calculate(rows: DataRow[], snapshot: DataSnapshot = {status:'ready',rows,totalCount:rows.length}) {
  return computedSnapshots(new Map([['scores',scores],['combined',combined]]),
    new Map<string,DataSnapshot>([['scores',snapshot],['combined',{status:'empty',totalCount:0}]]));
}

describe('引擎统一跳过缺失组织键，无需页面配置', () => {
  it('跳过空组织而保留零分和负分；合并与关联不重复计数，不改输入', () => {
    const rows=[{org:null,score:0},{org:'',score:2},{org:'  ',score:3},{org:'甲',score:0},{org:'乙',score:-2}];
    const before=structuredClone(rows);
    const result=calculate(rows);
    expect(result.get('combined')).toEqual({status:'ready',rows:[{org:'甲',score:0},{org:'乙',score:-2}],totalCount:2,
      warnings:[{code:'COMPUTE_MISSING_KEY_ROWS',sourceId:'scores',fields:['org'],message:'已跳过组织键为空的数据行',count:3}]});
    expect(result.get('scores')).toMatchObject({status:'ready',totalCount:5,rows:before});
    expect(rows).toEqual(before);
  });
  it('全部键为空时为空态，保留跳过数量，不生成虚构组织', () => {
    expect(calculate([{org:null,score:0}]).get('combined')).toEqual({status:'empty',totalCount:0,
      warnings:[{code:'COMPUTE_MISSING_KEY_ROWS',sourceId:'scores',fields:['org'],message:'已跳过组织键为空的数据行',count:1}]});
  });
  it('现有页面声明直接通过并集与关联，无需新增开关', () => {
    const dependencies=new Map([['scores',[{org:null,score:0},{org:'甲',score:0}]]]);
    expect(applyComputation(operators,[],dependencies)).toEqual([{org:'甲',score:0}]);
  });
  it('关联可单独处理左右两侧缺失组合键，0和false是有效键', () => {
    const join={...operators[1]!,keys:[{local:'org',foreign:'org'},{local:'team',foreign:'team'}]};
    expect(applyComputation([join],[{org:null,team:'x'},{org:0,team:false},{org:'absent',team:'x'}],
      new Map([['scores',[{org:0,team:null,score:9},{org:0,team:false,score:0}]]]))).toEqual([
        {org:0,team:false,score:0},{org:'absent',team:'x',score:null}
      ]);
  });
  it.each([NaN,Infinity,[],{}])('非法键不会被缺失策略吞掉 %s', value => {
    const op={...operators[0]!,keys:['org','team']};
    expect(()=>applyComputation([op],[],new Map([['scores',[{org:null,team:value} as unknown as DataRow]]]))).toThrow('类型不合法');
  });
  it('归一化的类型失配不是业务空值，不能跳过', () => {
    const normalized=normalizeQueryRows([{组织:12,得分:0}],{org:{...fields.org,queryField:'组织'},score:{...fields.score,queryField:'得分'}});
    if(!normalized.ok)throw Error('归一化失败');
    expect(()=>applyComputation(operators,[],new Map([['scores',normalized.rows]]))).toThrow('类型不合法');
  });
  it('有效组织重复仍失败；没有依赖仍失败', () => {
    expect(calculate([{org:'甲',score:0},{org:'甲',score:1}]).get('combined')?.status).toBe('error');
    expect(()=>applyComputation(operators,[],new Map())).toThrow('依赖尚未完成');
  });
  it.each([{status:'loading'},{status:'error',error:{code:'DQE_EXECUTION_ERROR',message:'失败'}}] as DataSnapshot[])(
    '保留依赖状态 %s', snapshot => expect(calculate([],snapshot).get('combined')?.status).toBe(snapshot.status));
  it('非零总数矛盾仍失败，跳过后不改写上游总数', () => {
    expect(calculate([{org:'甲',score:0}],{status:'ready',rows:[{org:'甲',score:0}],totalCount:2}).get('combined')?.status).toBe('error');
  });
  it('关联单独跳过本地空键后重算行数，告警传播至后续计算源', () => {
    const main: DataSource={fields,source:{type:'inline',rows:[]},compute:[operators[1]]};
    const downstream: DataSource={fields,source:{type:'inline',rows:[]},compute:[{...operators[0],sources:['main']}]};
    const result=computedSnapshots(new Map([['scores',scores],['main',main],['downstream',downstream]]),
      new Map<string,DataSnapshot>([['scores',{status:'ready',rows:[{org:'甲',score:0}],totalCount:1}],
        ['main',{status:'ready',rows:[{org:null},{org:'甲'}],totalCount:2}],['downstream',{status:'empty'}]]));
    expect(result.get('main')).toMatchObject({status:'ready',totalCount:1,rows:[{org:'甲',score:0}]});
    expect(result.get('downstream')).toMatchObject({status:'ready',totalCount:1,warnings:[{sourceId:'main',count:1}]});
  });
});
